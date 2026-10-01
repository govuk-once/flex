import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type {
  QueryCommandInput,
  ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect } from "vitest";

import { it } from "../extend/it";
import { resetClientMocks, restoreClientMocks } from "../utils/awsMock";

const TableName = "example";
const Key = { id: "1" };
const region = "eu-west-2";

const mockClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const mockCommands = {
  scan: (input: ScanCommandInput = { TableName }) =>
    mockClient.send(new ScanCommand(input)),
  query: (
    input: QueryCommandInput = {
      TableName,
      KeyConditionExpression: "#pk = :v",
    },
  ) => mockClient.send(new QueryCommand(input)),
  get: (key = Key) => mockClient.send(new GetCommand({ TableName, Key: key })),
  put: (item: Record<string, unknown> = { id: "1" }) =>
    mockClient.send(new PutCommand({ TableName, Item: item })),
  update: (key = Key) =>
    mockClient.send(
      new UpdateCommand({
        TableName,
        Key: key,
        UpdateExpression: "SET #0 = :0",
        ReturnValues: "ALL_NEW",
      }),
    ),
  delete: (key = Key) =>
    mockClient.send(new DeleteCommand({ TableName, Key: key })),
};

describe("createDynamoDBFixture", () => {
  beforeEach(() => {
    resetClientMocks();
  });

  afterEach(() => {
    restoreClientMocks();
  });

  describe("scan", () => {
    it("resolves the single page it was given", async ({ platform }) => {
      platform.dynamodb.scan.resolves([{ id: "1" }, { id: "2" }]);

      const result = await mockCommands.scan();

      expect(result.Items).toStrictEqual([{ id: "1" }, { id: "2" }]);
      expect(result.LastEvaluatedKey).toBeUndefined();
    });

    it("resolves an empty page when called with no pages", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves();

      const result = await mockCommands.scan();

      expect(result.Items).toStrictEqual([]);
    });

    it("provides a cursor for all pages except the last page", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves([{ id: "1" }], [{ id: "2" }]);

      const firstResult = await mockCommands.scan();
      const secondResult = await mockCommands.scan();

      expect(firstResult.LastEvaluatedKey).toStrictEqual(
        platform.dynamodb.scan.cursor(),
      );
      expect(secondResult.Items).toStrictEqual([{ id: "2" }]);
      expect(secondResult.LastEvaluatedKey).toBeUndefined();
    });

    it("continuously returns the last page when there are no more pages left", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves([{ id: "1" }]);

      const result = await mockCommands.scan();

      expect(result.Items).toStrictEqual([{ id: "1" }]);
    });

    it("records every scan the caller sent", async ({ platform }) => {
      platform.dynamodb.scan.resolves([]);

      await mockCommands.scan({ TableName: "first" });
      await mockCommands.scan({ TableName: "second" });

      expect(platform.dynamodb.scan.calls()).toHaveLength(2);
      expect(platform.dynamodb.scan.input()).toMatchObject({
        TableName: "first",
      });
      expect(platform.dynamodb.scan.input(1)).toMatchObject({
        TableName: "second",
      });
    });

    it("returns empty input when a scan has not been sent", ({ platform }) => {
      platform.dynamodb.scan.resolves([]);

      expect(platform.dynamodb.scan.input()).toBeUndefined();
    });

    it("rejects with the provided error", async ({ platform }) => {
      platform.dynamodb.scan.rejects(new Error("test error"));

      await expect(mockCommands.scan()).rejects.toThrow("test error");
    });
  });

  describe("query", () => {
    it("resolves the single page it was given", async ({ platform }) => {
      platform.dynamodb.query.resolves([{ id: "1" }, { id: "2" }]);

      const result = await mockCommands.query();

      expect(result.Items).toStrictEqual([{ id: "1" }, { id: "2" }]);
      expect(result.LastEvaluatedKey).toBeUndefined();
    });

    it("provides a cursor for all pages except the last page", async ({
      platform,
    }) => {
      platform.dynamodb.query.resolves([{ id: "1" }], [{ id: "2" }]);

      const firstResult = await mockCommands.query();
      const secondResult = await mockCommands.query();

      expect(firstResult.LastEvaluatedKey).toStrictEqual(
        platform.dynamodb.query.cursor(),
      );
      expect(secondResult.LastEvaluatedKey).toBeUndefined();
    });

    it("records every query the caller sent", async ({ platform }) => {
      platform.dynamodb.query.resolves([]);

      await mockCommands.query({
        TableName: "first",
        KeyConditionExpression: "#pk = :v",
      });

      expect(platform.dynamodb.query.calls()).toHaveLength(1);
      expect(platform.dynamodb.query.input()).toMatchObject({
        TableName: "first",
      });
    });

    it("rejects with the provided error", async ({ platform }) => {
      platform.dynamodb.query.rejects(new Error("test error"));

      await expect(mockCommands.query()).rejects.toThrow("test error");
    });
  });

  describe("get", () => {
    it("resolves the item it was given", async ({ platform }) => {
      platform.dynamodb.get.resolves({ id: "1", name: "Example" });

      const result = await mockCommands.get();

      expect(result.Item).toStrictEqual({ id: "1", name: "Example" });
    });

    it("resolves empty result when the item does not exist", async ({
      platform,
    }) => {
      platform.dynamodb.get.resolves();

      const result = await mockCommands.get();

      expect(result.Item).toBeUndefined();
    });

    it("records the key for each read", async ({ platform }) => {
      platform.dynamodb.get.resolves();

      await mockCommands.get({ id: "1" });
      await mockCommands.get({ id: "2" });

      expect(platform.dynamodb.get.calls()).toHaveLength(2);
      expect(platform.dynamodb.get.input()).toMatchObject({ Key: { id: "1" } });
      expect(platform.dynamodb.get.input(1)).toMatchObject({
        Key: { id: "2" },
      });
    });

    it("rejects with the provided error", async ({ platform }) => {
      platform.dynamodb.get.rejects(new Error("test error"));

      await expect(mockCommands.get()).rejects.toThrow("test error");
    });
  });

  describe("put", () => {
    it("resolves the put operation", async ({ platform }) => {
      platform.dynamodb.put.resolves();

      await expect(mockCommands.put()).resolves.toBeDefined();
    });

    it("records the item added to the table", async ({ platform }) => {
      platform.dynamodb.put.resolves();

      await mockCommands.put({ id: "1", name: "Example" });

      expect(platform.dynamodb.put.input()).toMatchObject({
        Item: { id: "1", name: "Example" },
      });
    });

    it("rejects with the provided error", async ({ platform }) => {
      platform.dynamodb.put.rejects(new Error("test error"));

      await expect(mockCommands.put()).rejects.toThrow("test error");
    });
  });

  describe("update", () => {
    it("resolves the item after the update operation succeeds", async ({
      platform,
    }) => {
      platform.dynamodb.update.resolves({ id: "1", name: "Updated" });

      const result = await mockCommands.update();

      expect(result.Attributes).toStrictEqual({
        id: "1",
        name: "Updated",
      });
    });

    it("resolves without attributes when the operation was empty", async ({
      platform,
    }) => {
      platform.dynamodb.update.resolves();

      const result = await mockCommands.update();

      expect(result.Attributes).toBeUndefined();
    });

    it("records the update the caller sent", async ({ platform }) => {
      platform.dynamodb.update.resolves();

      await mockCommands.update();

      expect(platform.dynamodb.update.input()).toMatchObject({
        Key,
        UpdateExpression: "SET #0 = :0",
        ReturnValues: "ALL_NEW",
      });
    });

    it("rejects with the provided error", async ({ platform }) => {
      platform.dynamodb.update.rejects(new Error("test error"));

      await expect(mockCommands.update()).rejects.toThrow("test error");
    });
  });

  describe("delete", () => {
    it("resolves the delete operation", async ({ platform }) => {
      platform.dynamodb.delete.resolves();

      await expect(mockCommands.delete()).resolves.toBeDefined();
    });

    it("records the key for each delete operation sent", async ({
      platform,
    }) => {
      platform.dynamodb.delete.resolves();

      await mockCommands.delete({ id: "1" });

      expect(platform.dynamodb.delete.input()).toMatchObject({
        Key: { id: "1" },
      });
    });

    it("rejects with the provided error", async ({ platform }) => {
      platform.dynamodb.delete.rejects(new Error("test error"));

      await expect(mockCommands.delete()).rejects.toThrow("test error");
    });
  });

  it("execute and record each command", async ({ platform }) => {
    platform.dynamodb.scan.resolves([{ id: "1" }]);
    platform.dynamodb.query.resolves([{ id: "2" }]);
    platform.dynamodb.get.resolves({ id: "3" });
    platform.dynamodb.put.resolves();
    platform.dynamodb.update.resolves({ id: "4" });
    platform.dynamodb.delete.resolves();

    await mockCommands.scan();
    await mockCommands.query();
    await mockCommands.get();
    await mockCommands.put();
    await mockCommands.update();
    await mockCommands.delete();

    expect(platform.dynamodb.scan.calls()).toHaveLength(1);
    expect(platform.dynamodb.query.calls()).toHaveLength(1);
    expect(platform.dynamodb.get.calls()).toHaveLength(1);
    expect(platform.dynamodb.put.calls()).toHaveLength(1);
    expect(platform.dynamodb.update.calls()).toHaveLength(1);
    expect(platform.dynamodb.delete.calls()).toHaveLength(1);
  });

  it("exposes the client mock to handle unsupported commands", ({
    platform,
  }) => {
    expect(platform.dynamodb.client().clientName()).toBe(
      "DynamoDBDocumentClient",
    );
  });
});
