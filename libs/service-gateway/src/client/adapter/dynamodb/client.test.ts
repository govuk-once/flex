import { logger } from "@flex/logging";
import { getAssumedRoleCredentials } from "@flex/sdk";
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";
import { createDynamoDBFixture } from "@flex/testing";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { DynamoDBAuth } from "../../../types";
import { createDynamoDBClient } from "./client";

vi.mock("@flex/logging");
vi.mock("@flex/telemetry");
vi.mock("@flex/sdk", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAssumedRoleCredentials: vi.fn(),
}));

const dynamodb = createDynamoDBFixture();

const table = "test-table";
const region = "eu-west-2";

const defaultAuth: DynamoDBAuth = { type: "default" };
const roleAuth: DynamoDBAuth = {
  type: "role",
  roleArn: "arn:aws:iam::123456789012:role/example",
  roleName: "test-session",
  externalId: "test-external-id",
};

const CountrySchema = z.object({
  slug: z.string(),
  country: z.string(),
  lastUpdated: z.string().default("2026-08-14T09:00:00.000Z"),
});

const france = {
  slug: "france",
  country: "France",
  lastUpdated: "2026-08-14T09:00:00.000Z",
};
const germany = {
  slug: "germany",
  country: "Germany",
  lastUpdated: "2026-08-14T09:00:00.000Z",
};

const buildClient = (auth: DynamoDBAuth = defaultAuth) =>
  createDynamoDBClient({ table, region, auth, schema: CountrySchema });

const throttled = () => {
  const error = new Error("Throughput exceeds the current capacity");

  error.name = "ProvisionedThroughputExceededException";

  return error;
};

const denied = () => {
  const error = new Error("User is not authorized to perform: dynamodb:Scan");

  error.name = "AccessDeniedException";

  return error;
};

describe("createDynamoDBClient", () => {
  describe("authentication", () => {
    it("reads with the invocation's own credentials by default", () => {
      buildClient();

      expect(getAssumedRoleCredentials).not.toHaveBeenCalled();
    });

    it("resolves cross-account credentials when a role is given", () => {
      buildClient(roleAuth);

      expect(getAssumedRoleCredentials).toHaveBeenCalledExactlyOnceWith({
        region,
        roleArn: "arn:aws:iam::123456789012:role/example",
        roleName: "test-session",
        externalId: "test-external-id",
      });
    });

    it("rejects an auth type it does not know how to build", () => {
      const auth = { type: "carrier-pigeon" } as unknown as DynamoDBAuth;

      expect(() => buildClient(auth)).toThrow("Unexpected value");
    });
  });

  describe("scan", () => {
    it("reads the table with no filter when none is given", async () => {
      dynamodb.scan.resolves([france]);

      const result = await buildClient().scan();

      expect(result).toStrictEqual({ ok: true, status: 200, data: [france] });
      expect(dynamodb.scan.input()).toMatchObject({ TableName: table });
      expect(dynamodb.scan.input()).not.toHaveProperty("FilterExpression");
      expect(dynamodb.scan.input()).not.toHaveProperty("IndexName");
    });

    it("filters on every attribute given", async () => {
      dynamodb.scan.resolves([france]);

      await buildClient().scan({ filter: { country: "France" } });

      expect(dynamodb.scan.input()).toMatchObject({
        FilterExpression: "#0 = :0",
        ExpressionAttributeNames: { "#0": "country" },
        ExpressionAttributeValues: { ":0": "France" },
      });
    });

    it("reads the index when one is named", async () => {
      dynamodb.scan.resolves([]);

      await buildClient().scan({ indexName: "country-index" });

      expect(dynamodb.scan.input()).toMatchObject({
        IndexName: "country-index",
      });
    });

    it("follows the cursor until the pages run out", async () => {
      dynamodb.scan.resolves([france], [germany]);

      const result = await buildClient().scan();

      expect(result).toStrictEqual({
        ok: true,
        status: 200,
        data: [france, germany],
      });
      expect(dynamodb.scan.calls()).toHaveLength(2);
      expect(dynamodb.scan.input(1)).toMatchObject({
        ExclusiveStartKey: dynamodb.scan.cursor(),
      });
    });

    it("reads an empty table as an empty list", async () => {
      dynamodb.scan.resolves();

      expect(await buildClient().scan()).toStrictEqual({
        ok: true,
        status: 200,
        data: [],
      });
    });

    it("strips attributes the schema does not declare", async () => {
      dynamodb.scan.resolves([{ ...france, internalKey: "drop" }]);

      expect(await buildClient().scan()).toStrictEqual({
        ok: true,
        status: 200,
        data: [france],
      });
    });

    it("fails with 502 when a stored item does not match the schema", async () => {
      dynamodb.scan.resolves([{ ...france, slug: 42 }]);

      const result = await buildClient().scan();

      expect(result).toMatchObject({
        ok: false,
        error: { status: 502, message: "Response validation failed" },
      });
      expect(emitTelemetry).toHaveBeenCalledWith(
        TelemetryEvent.response_validation_failed,
        { service: "dynamodb", table, operation: "Scan" },
      );
    });

    it("logs which attribute of the stored item failed", async () => {
      dynamodb.scan.resolves([{ ...france, slug: 42 }]);

      await buildClient().scan();

      expect(logger.error).toHaveBeenCalledExactlyOnceWith(
        "DynamoDB operation failed",
        {
          table,
          operation: "Scan",
          name: "ItemValidationError",
          reason: expect.stringContaining("slug") as string,
        },
      );
    });

    it("fails with 502 when the table cannot be read", async () => {
      dynamodb.scan.rejects(denied());

      const result = await buildClient().scan();

      expect(result).toStrictEqual({
        ok: false,
        error: {
          status: 502,
          message: "User is not authorized to perform: dynamodb:Scan",
        },
      });
      expect(emitTelemetry).toHaveBeenCalledWith(
        TelemetryEvent.third_party_request_error,
        {
          service: "dynamodb",
          table,
          operation: "Scan",
          name: "AccessDeniedException",
        },
      );
      expect(emitTelemetry).not.toHaveBeenCalledWith(
        TelemetryEvent.third_party_response_received,
        expect.anything(),
      );
    });

    it("logs the AWS error name, which the flattened 502 would otherwise lose", async () => {
      dynamodb.scan.rejects(denied());

      await buildClient().scan();

      expect(logger.error).toHaveBeenCalledExactlyOnceWith(
        "DynamoDB operation failed",
        {
          table,
          operation: "Scan",
          name: "AccessDeniedException",
          reason: "User is not authorized to perform: dynamodb:Scan",
        },
      );
    });

    it("fails with 429 when the table throttles, without the AWS wording", async () => {
      dynamodb.scan.rejects(throttled());

      expect(await buildClient().scan()).toStrictEqual({
        ok: false,
        error: { status: 429, message: "Too many requests" },
      });
    });

    it("counts the items it read", async () => {
      dynamodb.scan.resolves([france, germany]);

      await buildClient().scan();

      expect(emitTelemetry).toHaveBeenCalledWith(
        TelemetryEvent.third_party_request_sent,
        { service: "dynamodb", table, operation: "Scan" },
      );
      expect(emitTelemetry).toHaveBeenCalledWith(
        TelemetryEvent.third_party_response_received,
        { service: "dynamodb", table, operation: "Scan", count: 2 },
      );
    });
  });

  describe("query", () => {
    const key = { slug: "france" };

    it("reads the item collection the key names", async () => {
      dynamodb.query.resolves([france]);

      const result = await buildClient().query({ key });

      expect(result).toStrictEqual({ ok: true, status: 200, data: [france] });
      expect(dynamodb.query.input()).toMatchObject({
        TableName: table,
        KeyConditionExpression: "#0 = :0",
        ExpressionAttributeNames: { "#0": "slug" },
        ExpressionAttributeValues: { ":0": "france" },
      });
    });

    it("reads the index when one is named", async () => {
      dynamodb.query.resolves([]);

      await buildClient().query({ key, indexName: "country-index" });

      expect(dynamodb.query.input()).toMatchObject({
        IndexName: "country-index",
      });
    });

    it("filters on attributes outside the key", async () => {
      dynamodb.query.resolves([]);

      await buildClient().query({ key, filter: { country: "France" } });

      expect(dynamodb.query.input()).toMatchObject({
        KeyConditionExpression: "#0 = :0",
        FilterExpression: "#1 = :1",
      });
    });

    it("reads the sort key backwards when asked for the most recent first", async () => {
      dynamodb.query.resolves([]);

      await buildClient().query({ key, sort: "desc" });

      expect(dynamodb.query.input()).toMatchObject({
        ScanIndexForward: false,
      });
    });

    it("leaves the direction to DynamoDB when no sort is given", async () => {
      dynamodb.query.resolves([]);

      await buildClient().query({ key });

      expect(dynamodb.query.input()).not.toHaveProperty("ScanIndexForward");
    });

    it("follows the cursor until the collection is exhausted", async () => {
      dynamodb.query.resolves([france], [germany]);

      const result = await buildClient().query({ key });

      expect(result).toMatchObject({ data: [france, germany] });
      expect(dynamodb.query.input(1)).toMatchObject({
        ExclusiveStartKey: dynamodb.query.cursor(),
      });
    });

    it("fails with 500 when the key names nothing, before any read", async () => {
      dynamodb.query.resolves([]);

      const result = await buildClient().query({ key: {} });

      expect(result).toStrictEqual({
        ok: false,
        error: { status: 500, message: "A key must name the partition key" },
      });
      expect(dynamodb.query.calls()).toHaveLength(0);
      expect(emitTelemetry).toHaveBeenCalledWith(TelemetryEvent.error_thrown, {
        service: "dynamodb",
        table,
        operation: "Query",
      });
    });
  });

  describe("get", () => {
    it("reads the item its key addresses", async () => {
      dynamodb.get.resolves(france);

      const result = await buildClient().get({ key: { slug: "france" } });

      expect(result).toStrictEqual({ ok: true, status: 200, data: france });
      expect(dynamodb.get.input()).toStrictEqual({
        TableName: table,
        Key: { slug: "france" },
      });
    });

    it("reads a missing item as no item, not as a failure", async () => {
      dynamodb.get.resolves();

      expect(
        await buildClient().get({ key: { slug: "france" } }),
      ).toStrictEqual({ ok: true, status: 200, data: undefined });
    });

    it("addresses an item by its whole composite key", async () => {
      dynamodb.get.resolves(france);

      await buildClient().get({ key: { slug: "france", country: "France" } });

      expect(dynamodb.get.input()).toMatchObject({
        Key: { slug: "france", country: "France" },
      });
    });

    it("fails with 502 when the stored item does not match the schema", async () => {
      dynamodb.get.resolves({ slug: "france" });

      expect(
        await buildClient().get({ key: { slug: "france" } }),
      ).toMatchObject({ ok: false, error: { status: 502 } });
    });

    it("fails with 500 when the key addresses no single item", async () => {
      dynamodb.get.resolves(france);

      const result = await buildClient().get({ key: {} });

      expect(result).toMatchObject({ ok: false, error: { status: 500 } });
      expect(dynamodb.get.calls()).toHaveLength(0);
    });

    it("reports no count, having read at most one item", async () => {
      dynamodb.get.resolves(france);

      await buildClient().get({ key: { slug: "france" } });

      expect(emitTelemetry).toHaveBeenCalledWith(
        TelemetryEvent.third_party_response_received,
        { service: "dynamodb", table, operation: "GetItem" },
      );
    });
  });

  describe("put", () => {
    it("writes the item and hands back what was stored", async () => {
      dynamodb.put.resolves();

      const result = await buildClient().put({
        item: { slug: "france", country: "France" },
      });

      expect(result).toStrictEqual({ ok: true, status: 200, data: france });
      expect(dynamodb.put.input()).toStrictEqual({
        TableName: table,
        Item: france,
      });
    });

    it("writes what the schema produced, not what it was handed", async () => {
      dynamodb.put.resolves();

      await buildClient().put({
        item: { ...france, internalKey: "drop" } as never,
      });

      expect(dynamodb.put.input()).toMatchObject({ Item: france });
      expect(dynamodb.put.input()?.Item).not.toHaveProperty("internalKey");
    });

    it("fails with 400 without writing when the item breaks the schema", async () => {
      dynamodb.put.resolves();

      const result = await buildClient().put({
        item: { slug: "france" } as never,
      });

      expect(result).toMatchObject({
        ok: false,
        error: { status: 400, message: "Item validation failed" },
      });
      expect(dynamodb.put.calls()).toHaveLength(0);
      expect(emitTelemetry).toHaveBeenCalledWith(
        TelemetryEvent.request_validation_failed,
        { service: "dynamodb", table, operation: "PutItem" },
      );
    });

    it("carries the failing attributes, which the gateway passes on for a 4xx", async () => {
      dynamodb.put.resolves();

      const result = await buildClient().put({
        item: { slug: "france" } as never,
      });

      expect(result).toMatchObject({
        error: {
          body: { properties: { country: expect.anything() as unknown } },
        },
      });
    });

    it("fails with 502 when the table rejects the write", async () => {
      dynamodb.put.rejects(denied());

      expect(
        await buildClient().put({
          item: { slug: "france", country: "France" },
        }),
      ).toMatchObject({ ok: false, error: { status: 502 } });
    });
  });

  describe("update", () => {
    const key = { slug: "france" };

    it("sets the attributes given and returns the item as it now stands", async () => {
      dynamodb.update.resolves({ ...france, country: "Frankreich" });

      const result = await buildClient().update({
        key,
        set: { country: "Frankreich" },
      });

      expect(result).toStrictEqual({
        ok: true,
        status: 200,
        data: { ...france, country: "Frankreich" },
      });
      expect(dynamodb.update.input()).toStrictEqual({
        TableName: table,
        Key: key,
        UpdateExpression: "SET #0 = :0",
        ExpressionAttributeNames: { "#0": "country" },
        ExpressionAttributeValues: { ":0": "Frankreich" },
        ReturnValues: "ALL_NEW",
      });
    });

    it("removes the attributes named", async () => {
      dynamodb.update.resolves(france);

      await buildClient().update({ key, remove: ["lastUpdated"] });

      expect(dynamodb.update.input()).toMatchObject({
        UpdateExpression: "REMOVE #0",
        ExpressionAttributeNames: { "#0": "lastUpdated" },
      });
    });

    it("fails with 500 when the update would change nothing", async () => {
      dynamodb.update.resolves(france);

      const result = await buildClient().update({ key });

      expect(result).toStrictEqual({
        ok: false,
        error: {
          status: 500,
          message: "An update must set or remove at least one attribute",
        },
      });
      expect(dynamodb.update.calls()).toHaveLength(0);
    });

    it("fails with 500 when the update would alter the primary key", async () => {
      dynamodb.update.resolves(france);

      const result = await buildClient().update({
        key,
        set: { slug: "germany" },
      });

      expect(result).toMatchObject({
        ok: false,
        error: {
          status: 500,
          message: "An update cannot alter the primary key: slug",
        },
      });
    });

    it("fails with 502 when the updated item does not match the schema", async () => {
      dynamodb.update.resolves({ slug: "france" });

      expect(
        await buildClient().update({ key, set: { country: "Frankreich" } }),
      ).toMatchObject({ ok: false, error: { status: 502 } });
    });
  });

  describe("delete", () => {
    it("deletes the item its key addresses", async () => {
      dynamodb.delete.resolves();

      const result = await buildClient().delete({ key: { slug: "france" } });

      expect(result).toStrictEqual({
        ok: true,
        status: 200,
        data: undefined,
      });
      expect(dynamodb.delete.input()).toStrictEqual({
        TableName: table,
        Key: { slug: "france" },
      });
    });

    it("fails with 500 when the key addresses no single item", async () => {
      dynamodb.delete.resolves();

      const result = await buildClient().delete({ key: {} });

      expect(result).toMatchObject({ ok: false, error: { status: 500 } });
      expect(dynamodb.delete.calls()).toHaveLength(0);
    });

    it("fails with 502 when the table rejects the delete", async () => {
      dynamodb.delete.rejects(denied());

      expect(
        await buildClient().delete({ key: { slug: "france" } }),
      ).toMatchObject({ ok: false, error: { status: 502 } });
    });
  });
});
