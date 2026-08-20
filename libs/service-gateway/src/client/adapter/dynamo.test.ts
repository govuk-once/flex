import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { logger } from "@flex/logging";
import { getAssumedRoleCredentials } from "@flex/sdk";
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { DynamoAuth } from "./dynamo";
import { createDynamoClient } from "./dynamo";

vi.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: vi.fn() }));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: vi.fn() },
  ScanCommand: vi.fn(),
}));

vi.mock("@flex/logging");

vi.mock("@flex/sdk", () => ({ getAssumedRoleCredentials: vi.fn() }));

vi.mock("@flex/telemetry");

const tableName = "test-table";
const region = "eu-west-2";

const mockDefaultAuth: DynamoAuth = { type: "default" };
const mockAssumeRoleAuth: DynamoAuth = {
  // Deliberately not the table's region, so the two cannot be confused.
  type: "assume-role",
  region: "us-east-1",
  roleArn: "arn:aws:iam::123456789012:role/example",
  roleName: "test-session",
  externalId: "test-external-id",
};

const scanOptions = { attribute: "sourceNamespace", value: "travel" };

const franceRow = { slug: "france", country: "France" };
const germanyRow = { slug: "germany", country: "Germany" };

const buildClient = (auth: DynamoAuth = mockDefaultAuth) => {
  const send = vi.fn();

  vi.mocked(DynamoDBDocumentClient.from).mockReturnValue({
    send,
  } as unknown as DynamoDBDocumentClient);

  return { send, client: createDynamoClient({ auth, region, tableName }) };
};

const scanInputs = () =>
  vi.mocked(ScanCommand).mock.calls.map(([input]) => input);

describe("createDynamoClient", () => {
  it("builds the document client against the table's region", () => {
    buildClient();

    expect(DynamoDBClient).toHaveBeenCalledExactlyOnceWith({ region });
    expect(getAssumedRoleCredentials).not.toHaveBeenCalled();
    expect(DynamoDBDocumentClient.from).toHaveBeenCalledExactlyOnceWith(
      vi.mocked(DynamoDBClient).mock.instances[0],
    );
  });

  it("resolves cross-account credentials when the role is assumed", () => {
    const credentials = vi.fn();

    vi.mocked(getAssumedRoleCredentials).mockReturnValue(credentials);

    buildClient(mockAssumeRoleAuth);

    expect(getAssumedRoleCredentials).toHaveBeenCalledExactlyOnceWith({
      region: mockAssumeRoleAuth.region,
      roleArn: "arn:aws:iam::123456789012:role/example",
      roleName: "test-session",
      externalId: "test-external-id",
    });
    expect(DynamoDBClient).toHaveBeenCalledExactlyOnceWith({
      region,
      credentials,
    });
  });

  it("rejects an auth type it does not know how to build", () => {
    const auth = { type: "carrier-pigeon" } as unknown as DynamoAuth;

    expect(() => createDynamoClient({ auth, region, tableName })).toThrow(
      "Unexpected value",
    );
  });

  describe("scan", () => {
    it("filters the table to the requested attribute", async () => {
      const { client, send } = buildClient();

      send.mockResolvedValue({ Items: [] });

      await client.scan(scanOptions);

      expect(send).toHaveBeenCalledOnce();
      expect(scanInputs()).toStrictEqual([
        {
          TableName: tableName,
          FilterExpression: "#attribute = :value",
          ExpressionAttributeNames: { "#attribute": "sourceNamespace" },
          ExpressionAttributeValues: { ":value": "travel" },
          ExclusiveStartKey: undefined,
        },
      ]);
    });

    it("returns the raw items when no schema is given", async () => {
      const { client, send } = buildClient();

      send.mockResolvedValue({ Items: [franceRow, germanyRow] });

      const result = await client.scan(scanOptions);

      expect(result).toStrictEqual({
        ok: true,
        status: 200,
        data: [franceRow, germanyRow],
      });
    });

    it("treats a response without items as an empty page", async () => {
      const { client, send } = buildClient();

      send.mockResolvedValue({});

      const result = await client.scan(scanOptions);

      expect(result).toStrictEqual({ ok: true, status: 200, data: [] });
    });

    it("follows pagination until the table is exhausted", async () => {
      const { client, send } = buildClient();

      send
        .mockResolvedValueOnce({
          Items: [franceRow],
          LastEvaluatedKey: { slug: "france" },
        })
        .mockResolvedValueOnce({
          Items: [germanyRow],
          LastEvaluatedKey: { slug: "germany" },
        })
        .mockResolvedValueOnce({ Items: [] });

      const result = await client.scan(scanOptions);

      expect(send).toHaveBeenCalledTimes(3);
      expect(
        scanInputs().map((input) => input.ExclusiveStartKey),
      ).toStrictEqual([undefined, { slug: "france" }, { slug: "germany" }]);
      expect(result).toStrictEqual({
        ok: true,
        status: 200,
        data: [franceRow, germanyRow],
      });
    });

    it("validates each item against the schema, dropping undeclared attributes", async () => {
      const { client, send } = buildClient();

      send.mockResolvedValue({
        Items: [{ ...franceRow, internalKey: "drop" }],
      });

      const result = await client.scan({
        ...scanOptions,
        schema: z.object({ slug: z.string(), country: z.string() }),
      });

      expect(result).toStrictEqual({
        ok: true,
        status: 200,
        data: [franceRow],
      });
    });

    it("returns 502 when an item does not match the schema", async () => {
      const { client, send } = buildClient();

      send.mockResolvedValue({ Items: [{ slug: 42 }] });

      const result = await client.scan({
        ...scanOptions,
        schema: z.object({ slug: z.string() }),
      });

      expect(result).toMatchObject({
        ok: false,
        error: { status: 502, message: "Response validation failed" },
      });
      expect(emitTelemetry).toHaveBeenCalledWith(
        TelemetryEvent.response_validation_failed,
        { service: "dynamodb", tableName },
      );
    });

    it("logs which row failed schema validation", async () => {
      const { client, send } = buildClient();

      send.mockResolvedValue({ Items: [{ slug: 42 }] });

      await client.scan({
        ...scanOptions,
        schema: z.object({ slug: z.string() }),
      });

      expect(logger.error).toHaveBeenCalledExactlyOnceWith(
        "DynamoDB row failed schema validation",
        { tableName, issues: expect.stringContaining("slug") as string },
      );
    });

    it("returns 502 with the failure message when the scan throws", async () => {
      const { client, send } = buildClient();

      send.mockRejectedValue(new Error("ResourceNotFoundException"));

      const result = await client.scan(scanOptions);

      expect(result).toStrictEqual({
        ok: false,
        error: { status: 502, message: "ResourceNotFoundException" },
      });
      expect(emitTelemetry).toHaveBeenCalledWith(
        TelemetryEvent.third_party_request_error,
        { service: "dynamodb", tableName },
      );
      expect(emitTelemetry).not.toHaveBeenCalledWith(
        TelemetryEvent.third_party_response_received,
        expect.anything(),
      );
    });

    it("logs the AWS error name so the 502 can be told apart from the others", async () => {
      const { client, send } = buildClient();

      const error = new Error(
        "User is not authorized to perform: dynamodb:Scan",
      );
      error.name = "AccessDeniedException";

      send.mockRejectedValue(error);

      await client.scan(scanOptions);

      expect(logger.error).toHaveBeenCalledExactlyOnceWith(
        "DynamoDB scan failed",
        {
          tableName,
          name: "AccessDeniedException",
          reason: "User is not authorized to perform: dynamodb:Scan",
        },
      );
    });

    it("emits third party telemetry around the scan", async () => {
      const { client, send } = buildClient();

      send.mockResolvedValue({ Items: [franceRow, germanyRow] });

      await client.scan(scanOptions);

      expect(emitTelemetry).toHaveBeenCalledWith(
        TelemetryEvent.third_party_request_sent,
        { service: "dynamodb", operation: "Scan", tableName },
      );
      expect(emitTelemetry).toHaveBeenCalledWith(
        TelemetryEvent.third_party_response_received,
        { service: "dynamodb", tableName, count: 2 },
      );
    });
  });
});
