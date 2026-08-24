import { clearCaches } from "@aws-lambda-powertools/parameters";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { HttpFixture } from "@flex/testing";
import { it } from "@flex/testing";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, describe, expect } from "vitest";

import { handler } from "./gateway";
import { context, restApiEvent } from "./tests/fixtures";

const dynamo = mockClient(DynamoDBDocumentClient);

const mockSecretArn =
  "arn:aws:secretsmanager:eu-west-2:123456789012:secret:travel-consumer";

const mockConsumerConfig = {
  sourcesTableName: "development-travel-sources",
  region: "eu-west-2",
  roleArn: "arn:aws:iam::123456789012:role/travel-consumer-role",
  eventStoreTableName: "development-travel-events",
};

const jsonHeaders = { "Content-Type": "application/json" };

/** A row shaped the way the seed script writes it. */
const sourceRow = (
  slug: string,
  country: string,
  synonyms: string[] = [],
  overrides: Record<string, unknown> = {},
) => ({
  sourceID: `uuid-${slug}`,
  compositeKey: `travel/${slug}`,
  sourceNamespace: "travel",
  sourceGroup: slug,
  accessMethod: "api",
  URL: `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`,
  sourceEnabled: true,
  lastUpdated: "2026-08-14T09:00:00.000Z",
  sourceDetail: { slug, country, synonyms },
  ...overrides,
});

const franceRow = sourceRow("france", "France", ["Frankreich"]);
const germanyRow = sourceRow("germany", "Germany");

const france = {
  country: "France",
  slug: "france",
  lastUpdate: "2026-08-14T09:00:00.000Z",
  synonyms: ["Frankreich"],
};
const germany = {
  country: "Germany",
  slug: "germany",
  lastUpdate: "2026-08-14T09:00:00.000Z",
  synonyms: [],
};

/** Narrows the V2 result union, which is `string | StructuredResult`. */
const bodyOf = (result: Awaited<ReturnType<typeof handler>>): unknown =>
  JSON.parse((result as { body: string }).body);

const eventRow = (
  group: string,
  eventNote: string,
  eventTimestamp: string,
  overrides: Record<string, unknown> = {},
) => ({
  compositeKey: `travel/${group}`,
  namespace: "travel" as const,
  group,
  eventNote,
  eventTimestamp,
  ...overrides,
});

const franceEvent1 = eventRow(
  "france",
  "A update for france",
  "2026-08-15T09:00:00.000Z",
);
const franceEvent2 = eventRow(
  "france",
  "Another update for france",
  "2026-08-14T09:00:00.000Z",
);

// The event schema strips the DynamoDB-internal compositeKey from the response.
const toEventResponse = ({
  compositeKey: _key,
  ...rest
}: typeof franceEvent1) => rest;
const stubConsumerConfig = (http: HttpFixture) =>
  http
    .url("https://secretsmanager.eu-west-2.amazonaws.com")
    .post("/")
    .reply(200, {
      ARN: mockSecretArn,
      Name: "travel-consumer",
      SecretString: JSON.stringify(mockConsumerConfig),
    });

describe("Travel Service Gateway", () => {
  it.beforeEach(({ env }) => {
    clearCaches();
    dynamo.reset();
    env.set({ FLEX_TRAVEL_CONSUMER_CONFIG_SECRET_ARN: mockSecretArn });
  });

  afterEach(() => {
    dynamo.reset();
  });

  it("returns 404 for an unknown route", async () => {
    const result = await handler(
      restApiEvent.get("/gateways/travel/v1/should-throw"),
      context,
    );

    expect(result).toStrictEqual({
      statusCode: 404,
      headers: jsonHeaders,
      body: JSON.stringify({ message: "Route not found" }),
    });
  });

  describe("GET /v1/countries", () => {
    const endpoint = "/gateways/travel/v1/countries";

    it("returns every travel source mapped onto the country shape", async ({
      http,
    }) => {
      stubConsumerConfig(http);
      dynamo.on(ScanCommand).resolves({ Items: [franceRow, germanyRow] });

      const result = await handler(restApiEvent.get(endpoint), context);

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify([france, germany]),
      });
    });

    it("scans the sources table filtered to the travel namespace", async ({
      http,
    }) => {
      stubConsumerConfig(http);
      dynamo.on(ScanCommand).resolves({ Items: [franceRow] });

      await handler(restApiEvent.get(endpoint), context);

      expect(dynamo.commandCalls(ScanCommand)).toHaveLength(1);
      expect(dynamo.commandCalls(ScanCommand)[0]?.args[0].input).toMatchObject({
        TableName: "development-travel-sources",
        FilterExpression: "#attribute = :value",
        ExpressionAttributeNames: { "#attribute": "sourceNamespace" },
        ExpressionAttributeValues: { ":value": "travel" },
      });
    });

    it("drops the table's key and internal attributes from the response", async ({
      http,
    }) => {
      stubConsumerConfig(http);
      dynamo.on(ScanCommand).resolves({ Items: [franceRow] });

      const result = await handler(restApiEvent.get(endpoint), context);

      expect(bodyOf(result)).toStrictEqual([france]);
    });

    it("sorts by country name so the list is repeatable", async ({ http }) => {
      stubConsumerConfig(http);
      dynamo.on(ScanCommand).resolves({ Items: [germanyRow, franceRow] });

      const result = await handler(restApiEvent.get(endpoint), context);

      expect(bodyOf(result)).toStrictEqual([france, germany]);
    });

    it("omits sources the operator has disabled", async ({ http }) => {
      stubConsumerConfig(http);
      dynamo.on(ScanCommand).resolves({
        Items: [
          franceRow,
          sourceRow("germany", "Germany", [], { sourceEnabled: false }),
        ],
      });

      const result = await handler(restApiEvent.get(endpoint), context);

      expect(bodyOf(result)).toStrictEqual([france]);
    });

    it("returns an empty list when the namespace holds no sources", async ({
      http,
    }) => {
      stubConsumerConfig(http);
      dynamo.on(ScanCommand).resolves({ Items: [] });

      const result = await handler(restApiEvent.get(endpoint), context);

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify([]),
      });
    });

    it("follows pagination until the table is exhausted", async ({ http }) => {
      stubConsumerConfig(http);
      dynamo
        .on(ScanCommand)
        .resolvesOnce({
          Items: [franceRow],
          LastEvaluatedKey: { sourceID: "uuid-france" },
        })
        .resolvesOnce({ Items: [germanyRow] });

      const result = await handler(restApiEvent.get(endpoint), context);

      expect(dynamo.commandCalls(ScanCommand)).toHaveLength(2);
      expect(dynamo.commandCalls(ScanCommand)[1]?.args[0].input).toMatchObject({
        ExclusiveStartKey: { sourceID: "uuid-france" },
      });
      expect(bodyOf(result)).toStrictEqual([france, germany]);
    });

    it("returns 502 when the table scan fails", async ({ http }) => {
      stubConsumerConfig(http);
      dynamo.on(ScanCommand).rejects(new Error("ResourceNotFoundException"));

      const result = await handler(restApiEvent.get(endpoint), context);

      expect(result).toStrictEqual({
        statusCode: 502,
        headers: jsonHeaders,
        body: JSON.stringify({
          message: "TRAVEL upstream service unavailable",
        }),
      });
    });

    it("returns 502 when a row does not match the source schema", async ({
      http,
    }) => {
      stubConsumerConfig(http);
      dynamo.on(ScanCommand).resolves({
        Items: [sourceRow("france", "France", [], { lastUpdated: "nope" })],
      });

      const result = await handler(restApiEvent.get(endpoint), context);

      expect(result).toMatchObject({ statusCode: 502 });
    });
  });

  describe("GET /v1/events", () => {
    const endpoint = "/gateways/travel/v1/events";
    const query = { namespace: "travel", group: "france" };

    it("returns the events for the requested namespace and group", async ({
      http,
    }) => {
      stubConsumerConfig(http);
      dynamo.on(QueryCommand).resolves({ Items: [franceEvent1, franceEvent2] });

      const result = await handler(restApiEvent.get(endpoint, query), context);

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify([franceEvent1, franceEvent2].map(toEventResponse)),
      });
    });

    it("queries the events table by compositeKey on the timestamp index in descending order", async ({
      http,
    }) => {
      stubConsumerConfig(http);
      dynamo.on(QueryCommand).resolves({ Items: [franceEvent1] });

      await handler(restApiEvent.get(endpoint, query), context);

      expect(dynamo.commandCalls(QueryCommand)).toHaveLength(1);
      expect(dynamo.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject(
        {
          TableName: "development-travel-events",
          IndexName: "timestamp-query",
          KeyConditionExpression: "#pk = :pkValue",
          ExpressionAttributeNames: { "#pk": "compositeKey" },
          ExpressionAttributeValues: { ":pkValue": "travel/france" },
          ScanIndexForward: false,
        },
      );
    });

    it("returns an empty list when no events exist for the group", async ({
      http,
    }) => {
      stubConsumerConfig(http);
      dynamo.on(QueryCommand).resolves({ Items: [] });

      const result = await handler(restApiEvent.get(endpoint, query), context);

      expect(result).toStrictEqual({
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify([]),
      });
    });

    it("returns 400 when namespace query parameter is missing", async () => {
      const result = await handler(
        restApiEvent.get(endpoint, { group: "france" }),
        context,
      );

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it("returns 400 when group query parameter is missing", async () => {
      const result = await handler(
        restApiEvent.get(endpoint, { namespace: "travel" }),
        context,
      );

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it("returns 502 when the query throws", async ({ http }) => {
      stubConsumerConfig(http);
      dynamo.on(QueryCommand).rejects(new Error("ResourceNotFoundException"));

      const result = await handler(restApiEvent.get(endpoint, query), context);

      expect(result).toStrictEqual({
        statusCode: 502,
        headers: jsonHeaders,
        body: JSON.stringify({
          message: "TRAVEL upstream service unavailable",
        }),
      });
    });

    it("returns 502 when a row does not match the event schema", async ({
      http,
    }) => {
      stubConsumerConfig(http);
      dynamo.on(QueryCommand).resolves({
        Items: [eventRow("france", "A update", "not-a-date")],
      });

      const result = await handler(restApiEvent.get(endpoint, query), context);

      expect(result).toMatchObject({ statusCode: 502 });
    });
  });
});
