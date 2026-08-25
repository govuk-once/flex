import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetClientMocks, restoreClientMocks } from "../utils/awsMock";
import { createDynamoFixture } from "./dynamo";

const dynamo = createDynamoFixture();

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "eu-west-2" }),
);

const scan = (input: ScanCommandInput = { TableName: "example" }) =>
  client.send(new ScanCommand(input));

describe("createDynamoFixture", () => {
  beforeEach(() => {
    resetClientMocks();
  });

  afterEach(() => {
    restoreClientMocks();
  });

  it("resolves the single page it was given", async () => {
    dynamo.scan.resolves([{ id: "1" }, { id: "2" }]);

    const result = await scan();

    expect(result.Items).toStrictEqual([{ id: "1" }, { id: "2" }]);
    expect(result.LastEvaluatedKey).toBeUndefined();
  });

  it("resolves an empty page when called with no pages", async () => {
    dynamo.scan.resolves();

    expect((await scan()).Items).toStrictEqual([]);
  });

  it("hands back a cursor on every page but the last", async () => {
    dynamo.scan.resolves([{ id: "1" }], [{ id: "2" }]);

    const first = await scan();
    const second = await scan();

    expect(first.LastEvaluatedKey).toStrictEqual(dynamo.scan.cursor());
    expect(second.Items).toStrictEqual([{ id: "2" }]);
    expect(second.LastEvaluatedKey).toBeUndefined();
  });

  it("keeps returning the last page once the pages run out", async () => {
    dynamo.scan.resolves([{ id: "1" }]);

    await scan();

    expect((await scan()).Items).toStrictEqual([{ id: "1" }]);
  });

  it("records every scan the caller sent", async () => {
    dynamo.scan.resolves([]);

    await scan({ TableName: "first" });
    await scan({ TableName: "second" });

    expect(dynamo.scan.calls()).toHaveLength(2);
    expect(dynamo.scan.input()).toMatchObject({ TableName: "first" });
    expect(dynamo.scan.input(1)).toMatchObject({ TableName: "second" });
  });

  it("returns no input for a scan that was never sent", () => {
    dynamo.scan.resolves([]);

    expect(dynamo.scan.input()).toBeUndefined();
  });

  it("rejects with the given error", async () => {
    dynamo.scan.rejects(new Error("ResourceNotFoundException"));

    await expect(scan()).rejects.toThrow("ResourceNotFoundException");
  });

  it("exposes the client mock for commands the helpers do not cover", () => {
    expect(dynamo.client().clientName()).toBe("DynamoDBDocumentClient");
  });
});
