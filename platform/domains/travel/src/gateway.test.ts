import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./gateway";

const consumerConfig = {
  sourcesTableName: "development-travel-sources",
  region: "eu-west-2",
  roleArn: "arn:aws:iam::123456789012:role/travel-consumer-role",
};

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
      platform.dynamo.scan.resolves([franceRow, germanyRow]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: [france, germany] }),
      );
    });

    it("scans the sources table filtered to the travel namespace", async ({
      platform,
    }) => {
      platform.dynamo.scan.resolves([franceRow]);

      await handler(platform.gatewayEvent.get(endpoint), platform.context());

      expect(platform.dynamo.scan.calls()).toHaveLength(1);
      expect(platform.dynamo.scan.input()).toMatchObject({
        TableName: consumerConfig.sourcesTableName,
        FilterExpression: "#attribute = :value",
        ExpressionAttributeNames: { "#attribute": "sourceNamespace" },
        ExpressionAttributeValues: { ":value": "travel" },
      });
    });

    it("drops the table's key and internal attributes from the response", async ({
      platform,
    }) => {
      platform.dynamo.scan.resolves([franceRow]);

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
      platform.dynamo.scan.resolves([germanyRow, franceRow]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: [france, germany] }),
      );
    });

    it("omits sources the operator has disabled", async ({ platform }) => {
      platform.dynamo.scan.resolves([
        franceRow,
        sourceRow("germany", "Germany", [], { sourceEnabled: false }),
      ]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: [france] }),
      );
    });

    it("returns an empty list when the namespace holds no sources", async ({
      platform,
    }) => {
      platform.dynamo.scan.resolves([]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toStrictEqual(platform.gatewayResult(200, { body: [] }));
    });

    it("follows pagination until the table is exhausted", async ({
      platform,
    }) => {
      platform.dynamo.scan.resolves([franceRow], [germanyRow]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(platform.dynamo.scan.calls()).toHaveLength(2);
      expect(platform.dynamo.scan.input(1)).toMatchObject({
        ExclusiveStartKey: platform.dynamo.scan.cursor(),
      });
      expect(result).toStrictEqual(
        platform.gatewayResult(200, { body: [france, germany] }),
      );
    });

    it("returns 502 when the table scan fails", async ({ platform }) => {
      platform.dynamo.scan.rejects(new Error("ResourceNotFoundException"));

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
      platform.dynamo.scan.resolves([
        sourceRow("france", "France", [], { lastUpdated: "nope" }),
      ]);

      const result = await handler(
        platform.gatewayEvent.get(endpoint),
        platform.context(),
      );

      expect(result).toMatchObject({ statusCode: 502 });
    });
  });
});
