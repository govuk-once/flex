import { it, uuid } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./gateway";

const consumerConfig = {
  sourcesTableName: "development-travel-sources",
  eventStoreTableName: "development-travel-events",
  region: "eu-west-2",
  roleArn: "arn:aws:iam::123456789012:role/travel-consumer-role",
};

const sourceIds: Record<string, string> = {
  france: "5f0c4c9a-3f2b-4a1d-9c7e-1b2d3e4f5a6b",
  germany: "7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f",
};

/** A row shaped the way the seed script writes it. */
const sourceRow = (
  slug: string,
  country: string,
  synonyms: string[] = [],
  overrides: Record<string, unknown> = {},
) => ({
  sourceID: sourceIds[slug] ?? uuid,
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

describe("Travel Service Gateway", () => {
  it.beforeEach(({ env, platform }) => {
    env.set({
      FLEX_TRAVEL_CONSUMER_CONFIG_SECRET_ARN: platform.secret.resolves(
        "travel-consumer",
        consumerConfig,
      ),
    });
  });

  it("returns 404 for an unknown route", async ({ platform }) => {
    const result = await handler(
      platform.gatewayEvent.get("/v1/should-throw"),
      platform.context(),
    );

    expect(result).toStrictEqual(
      platform.gatewayResult(404, { body: { message: "Route not found" } }),
    );
  });

  describe("GET /v1/countries", () => {
    const endpoint = "/v1/countries";

    it("returns every travel source mapped onto the country shape", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves([franceRow, germanyRow]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: [france, germany] }),
      );
    });

    it("scans the sources table for enabled travel namespaces", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves([franceRow]);

      await handler(platform.gatewayEvent.get(endpoint), platform.context());

      expect(platform.dynamodb.scan.calls()).toHaveLength(1);
      expect(platform.dynamodb.scan.input()).toMatchObject({
        TableName: consumerConfig.sourcesTableName,
        FilterExpression: "#0 = :0 AND #1 = :1",
        ExpressionAttributeNames: {
          "#0": "sourceNamespace",
          "#1": "sourceEnabled",
        },
        ExpressionAttributeValues: { ":0": "travel", ":1": true },
      });
    });

    it("drops the table's key and internal attributes from the response", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves([franceRow]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: [france] }),
      );
    });

    it("sorts by country name so the list is repeatable", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves([germanyRow, franceRow]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: [france, germany] }),
      );
    });

    it("scans the sources table and filters disabled sources", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves([franceRow]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(platform.dynamodb.scan.input()).toMatchObject({
        ExpressionAttributeValues: { ":1": true },
      });
      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: [france] }),
      );
    });

    it("returns an empty list when the namespace holds no sources", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves([]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toStrictEqual(platform.gatewayResult(200, { body: [] }));
    });

    it("follows pagination until the table is exhausted", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves([franceRow], [germanyRow]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(platform.dynamodb.scan.calls()).toHaveLength(2);
      expect(platform.dynamodb.scan.input(1)).toMatchObject({
        ExclusiveStartKey: platform.dynamodb.scan.cursor(),
      });
      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: [france, germany] }),
      );
    });

    it("returns 502 when the table scan fails", async ({ platform }) => {
      platform.dynamodb.scan.rejects(new Error("ResourceNotFoundException"));

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(502, {
          body: { message: "TRAVEL upstream service unavailable" },
        }),
      );
    });

    it("returns 502 when a row does not match the source schema", async ({
      platform,
    }) => {
      platform.dynamodb.scan.resolves([
        sourceRow("france", "France", [], { lastUpdated: "nope" }),
      ]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toMatchObject({ statusCode: 502 });
    });
  });

  describe("GET /v1/events", () => {
    const endpoint = "/v1/events";
    const query = { namespace: "travel", group: "france" };

    it("returns the events for the requested namespace and group", async ({
      platform,
    }) => {
      platform.dynamodb.query.resolves([franceEvent1, franceEvent2]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint, { query }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, {
          body: [franceEvent1, franceEvent2].map(toEventResponse),
        }),
      );
    });

    it("queries the events table by compositeKey on the timestamp index in descending order", async ({
      platform,
    }) => {
      platform.dynamodb.query.resolves([franceEvent1]);

      await handler(
        platform.gatewayEvent.get(endpoint, { query }),
        platform.context(),
      );

      expect(platform.dynamodb.query.calls()).toHaveLength(1);
      expect(platform.dynamodb.query.input()).toMatchObject({
        TableName: consumerConfig.eventStoreTableName,
        IndexName: "timestamp-query",
        KeyConditionExpression: "#0 = :0",
        ExpressionAttributeNames: { "#0": "compositeKey" },
        ExpressionAttributeValues: { ":0": "travel/france" },
        ScanIndexForward: false,
      });
    });

    it("returns an empty list when no events exist for the group", async ({
      platform,
    }) => {
      platform.dynamodb.query.resolves([]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint, { query }),
        platform.context(),
      );

      expect(result).toStrictEqual(platform.gatewayResult(200, { body: [] }));
    });

    it("returns 400 when namespace query parameter is missing", async ({
      platform,
    }) => {
      const result = await handler(
        platform.gatewayEvent.get(endpoint, { query: { group: "france" } }),
        platform.context(),
      );

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it("returns 400 when group query parameter is missing", async ({
      platform,
    }) => {
      const result = await handler(
        platform.gatewayEvent.get(endpoint, { query: { namespace: "travel" } }),
        platform.context(),
      );

      expect(result).toMatchObject({ statusCode: 400 });
    });

    it("returns 502 when the query throws", async ({ platform }) => {
      platform.dynamodb.query.rejects(new Error("ResourceNotFoundException"));

      const result = await handler(
        platform.gatewayEvent.get(endpoint, { query }),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(502, {
          body: { message: "TRAVEL upstream service unavailable" },
        }),
      );
    });

    it("returns 502 when a row does not match the event schema", async ({
      platform,
    }) => {
      platform.dynamodb.query.resolves([
        eventRow("france", "A update", "not-a-date"),
      ]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint, { query }),
        platform.context(),
      );

      expect(result).toMatchObject({ statusCode: 502 });
    });
  });
});
