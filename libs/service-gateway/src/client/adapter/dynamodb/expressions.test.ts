import { describe, expect, it } from "vitest";

import {
  createExpressionAttributes,
  toKeyAttributes,
  toQueryExpressions,
  toScanExpressions,
  toUpdateExpressions,
} from "./expressions";

const key = { compositeKey: "travel/france" };

describe("createExpressionAttributes", () => {
  it("builds nothing when no attribute was referenced", () => {
    expect(createExpressionAttributes().build()).toStrictEqual({});
  });

  it("hands the same placeholder back for a repeated name", () => {
    const attributes = createExpressionAttributes();

    expect(attributes.name("slug")).toBe("#0");
    expect(attributes.name("country")).toBe("#1");
    expect(attributes.name("slug")).toBe("#0");

    expect(attributes.build()).toStrictEqual({
      ExpressionAttributeNames: { "#0": "slug", "#1": "country" },
    });
  });

  it("gives each value its own placeholder, however alike", () => {
    const attributes = createExpressionAttributes();

    expect(attributes.value("france")).toBe(":0");
    expect(attributes.value("france")).toBe(":1");

    expect(attributes.build()).toStrictEqual({
      ExpressionAttributeValues: { ":0": "france", ":1": "france" },
    });
  });
});

describe("toScanExpressions", () => {
  it("builds no filter when none was given", () => {
    expect(toScanExpressions()).toStrictEqual({});
    expect(toScanExpressions({})).toStrictEqual({});
  });

  it("ANDs one equality per attribute", () => {
    expect(
      toScanExpressions({ sourceNamespace: "travel", sourceEnabled: true }),
    ).toStrictEqual({
      FilterExpression: "#0 = :0 AND #1 = :1",
      ExpressionAttributeNames: {
        "#0": "sourceNamespace",
        "#1": "sourceEnabled",
      },
      ExpressionAttributeValues: { ":0": "travel", ":1": true },
    });
  });

  it("ignores an attribute left undefined, rather than matching null", () => {
    expect(
      toScanExpressions({ sourceNamespace: "travel", sourceGroup: undefined }),
    ).toStrictEqual({
      FilterExpression: "#0 = :0",
      ExpressionAttributeNames: { "#0": "sourceNamespace" },
      ExpressionAttributeValues: { ":0": "travel" },
    });
  });

  it("keeps a false or empty value, which is a predicate like any other", () => {
    expect(toScanExpressions({ sourceEnabled: false })).toMatchObject({
      ExpressionAttributeValues: { ":0": false },
    });
  });
});

describe("toQueryExpressions", () => {
  it("matches the partition key for equality", () => {
    expect(toQueryExpressions(key)).toStrictEqual({
      KeyConditionExpression: "#0 = :0",
      ExpressionAttributeNames: { "#0": "compositeKey" },
      ExpressionAttributeValues: { ":0": "travel/france" },
    });
  });

  it("narrows to one sort key value when the key names both", () => {
    expect(
      toQueryExpressions({
        ...key,
        eventTimestamp: "2026-08-14T09:00:00.000Z",
      }),
    ).toMatchObject({
      KeyConditionExpression: "#0 = :0 AND #1 = :1",
      ExpressionAttributeNames: {
        "#0": "compositeKey",
        "#1": "eventTimestamp",
      },
    });
  });

  it("numbers filter placeholders on from the key's, so neither collides", () => {
    expect(toQueryExpressions(key, { group: "france" })).toStrictEqual({
      KeyConditionExpression: "#0 = :0",
      FilterExpression: "#1 = :1",
      ExpressionAttributeNames: { "#0": "compositeKey", "#1": "group" },
      ExpressionAttributeValues: { ":0": "travel/france", ":1": "france" },
    });
  });

  it("shares one placeholder when the filter repeats a key attribute", () => {
    expect(
      toQueryExpressions(key, { compositeKey: "travel/germany" }),
    ).toStrictEqual({
      KeyConditionExpression: "#0 = :0",
      FilterExpression: "#0 = :1",
      ExpressionAttributeNames: { "#0": "compositeKey" },
      ExpressionAttributeValues: {
        ":0": "travel/france",
        ":1": "travel/germany",
      },
    });
  });

  it("rejects a key that names nothing", () => {
    expect(() => toQueryExpressions({})).toThrow(
      "A key must name the partition key",
    );
    expect(() => toQueryExpressions({ compositeKey: undefined })).toThrow(
      "A key must name the partition key",
    );
  });

  it("rejects a key too large to be a primary key", () => {
    expect(() =>
      toQueryExpressions({ ...key, eventTimestamp: "2026", group: "france" }),
    ).toThrow("A key may only name the partition key and the sort key");
  });
});

describe("toKeyAttributes", () => {
  it("passes the key through as the attributes that address the item", () => {
    expect(toKeyAttributes({ ...key, eventTimestamp: "2026" })).toStrictEqual({
      compositeKey: "travel/france",
      eventTimestamp: "2026",
    });
  });

  it("drops an attribute left undefined", () => {
    expect(
      toKeyAttributes({ ...key, eventTimestamp: undefined }),
    ).toStrictEqual(key);
  });

  it("rejects a key that addresses no single item", () => {
    expect(() => toKeyAttributes({})).toThrow(
      "A key must name the partition key",
    );
  });
});

describe("toUpdateExpressions", () => {
  it("sets each attribute given", () => {
    expect(
      toUpdateExpressions(key, { eventNote: "Updated", group: "france" }),
    ).toStrictEqual({
      UpdateExpression: "SET #0 = :0, #1 = :1",
      ExpressionAttributeNames: { "#0": "eventNote", "#1": "group" },
      ExpressionAttributeValues: { ":0": "Updated", ":1": "france" },
    });
  });

  it("removes each attribute named, with no value to bind", () => {
    expect(
      toUpdateExpressions(key, undefined, ["eventNote", "group"]),
    ).toStrictEqual({
      UpdateExpression: "REMOVE #0, #1",
      ExpressionAttributeNames: { "#0": "eventNote", "#1": "group" },
    });
  });

  it("writes both clauses in one expression", () => {
    expect(
      toUpdateExpressions(key, { eventNote: "Updated" }, ["group"]),
    ).toMatchObject({ UpdateExpression: "SET #0 = :0 REMOVE #1" });
  });

  it("ignores an attribute set to undefined", () => {
    expect(
      toUpdateExpressions(key, { eventNote: "Updated", group: undefined }),
    ).toMatchObject({
      UpdateExpression: "SET #0 = :0",
      ExpressionAttributeNames: { "#0": "eventNote" },
    });
  });

  it("rejects an update that would change nothing", () => {
    expect(() => toUpdateExpressions(key, {}, [])).toThrow(
      "An update must set or remove at least one attribute",
    );
    expect(() => toUpdateExpressions(key, { eventNote: undefined })).toThrow(
      "An update must set or remove at least one attribute",
    );
  });

  it("rejects an attribute both set and removed, which DynamoDB will not do", () => {
    expect(() =>
      toUpdateExpressions(key, { eventNote: "Updated" }, ["eventNote"]),
    ).toThrow("An update cannot both set and remove eventNote");
  });

  it("rejects altering the primary key, which takes a new item", () => {
    expect(() =>
      toUpdateExpressions(key, { compositeKey: "travel/germany" }),
    ).toThrow("An update cannot alter the primary key: compositeKey");

    expect(() => toUpdateExpressions(key, undefined, ["compositeKey"])).toThrow(
      "An update cannot alter the primary key: compositeKey",
    );
  });

  it("rejects an update addressed at no single item", () => {
    expect(() => toUpdateExpressions({}, { eventNote: "Updated" })).toThrow(
      "A key must name the partition key",
    );
  });
});
