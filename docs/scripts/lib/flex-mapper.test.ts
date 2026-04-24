import { describe, expect, it } from "vitest";

import {
  mapContract,
  mapIntegration,
  mapPlatformConfig,
  mapResource,
  mapSchemaObject,
  mapSchemaValue,
} from "./flex-mapper";

describe("mapSchemaValue", () => {
  it("maps primitive types", () => {
    expect(mapSchemaValue("string")).toEqual({ type: "string" });
    expect(mapSchemaValue("integer")).toEqual({ type: "integer" });
    expect(mapSchemaValue("number")).toEqual({ type: "number" });
    expect(mapSchemaValue("boolean")).toEqual({ type: "boolean" });
  });

  it("maps format types", () => {
    expect(mapSchemaValue("url")).toEqual({ type: "string", format: "uri" });
    expect(mapSchemaValue("date")).toEqual({ type: "string", format: "date" });
    expect(mapSchemaValue("datetime")).toEqual({
      type: "string",
      format: "date-time",
    });
    expect(mapSchemaValue("email")).toEqual({
      type: "string",
      format: "email",
    });
    expect(mapSchemaValue("uuid")).toEqual({ type: "string", format: "uuid" });
    expect(mapSchemaValue("slug")).toEqual({
      type: "string",
      pattern: "^[a-z]+(-[a-z]+)*$",
    });
  });

  it("maps enum shorthand", () => {
    expect(mapSchemaValue("enum:a,b,c")).toEqual({
      type: "string",
      enum: ["a", "b", "c"],
    });
  });

  it("maps schema references (uppercase)", () => {
    expect(mapSchemaValue("Authority")).toEqual({
      $ref: "#/components/schemas/Authority",
    });
  });

  it("maps array shorthand", () => {
    expect(mapSchemaValue("Notification[]")).toEqual({
      type: "array",
      items: { $ref: "#/components/schemas/Notification" },
    });
  });

  it("maps primitive array shorthand", () => {
    expect(mapSchemaValue("string[]")).toEqual({
      type: "array",
      items: { type: "string" },
    });
  });

  it("strips ! suffix from value", () => {
    expect(mapSchemaValue("string!")).toEqual({ type: "string" });
    expect(mapSchemaValue("uuid!")).toEqual({ type: "string", format: "uuid" });
  });

  it("strips ? suffix from value", () => {
    expect(mapSchemaValue("string?")).toEqual({ type: "string" });
    expect(mapSchemaValue("Authority?")).toEqual({
      $ref: "#/components/schemas/Authority",
    });
  });
});

describe("mapSchemaObject", () => {
  it("expands shorthand properties to JSON Schema object", () => {
    const result = mapSchemaObject({
      name: "string!",
      age: "integer",
    });

    expect(result).toEqual({
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", minLength: 1 },
        age: { type: "integer" },
      },
    });
  });

  it("handles ? suffix on key for optional fields", () => {
    const result = mapSchemaObject({
      "name": "string!",
      "parent?": "Authority",
    });

    expect(result.required).toEqual(["name"]);
    expect((result.properties as Record<string, unknown>)["parent"]).toEqual({
      $ref: "#/components/schemas/Authority",
    });
  });

  it("passes through standard JSON Schema objects", () => {
    const standard = {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    };

    const result = mapSchemaObject(standard);

    expect(result.type).toBe("object");
    expect(result.required).toEqual(["id"]);
  });

  it("handles nested shorthand objects", () => {
    const result = mapSchemaObject({
      "address": {
        "line1": "string!",
        "postcode?": "string",
      },
    });

    const address = (result.properties as Record<string, unknown>)[
      "address"
    ] as Record<string, unknown>;
    expect(address.type).toBe("object");
    expect(address.required).toEqual(["line1"]);
  });

  it("handles spread operator", () => {
    const result = mapSchemaObject({
      "...": "AuthorityFields",
      "parent?": "AuthorityFields",
    });

    expect(result.allOf).toBeDefined();
    const allOf = result.allOf as Record<string, unknown>[];
    expect(allOf[0]).toEqual({
      $ref: "#/components/schemas/AuthorityFields",
    });
    expect(allOf[1]).toEqual({
      type: "object",
      properties: {
        parent: { $ref: "#/components/schemas/AuthorityFields" },
      },
    });
  });

  it("handles ! suffix on key name (required + minLength for strings)", () => {
    const result = mapSchemaObject({
      "name!": "string",
    });

    expect(result.required).toEqual(["name"]);
    expect((result.properties as Record<string, unknown>)["name"]).toEqual({
      type: "string",
      minLength: 1,
    });
  });

  it("handles ! on key combined with ! on value without duplication", () => {
    const result = mapSchemaObject({
      "name!": "string!",
    });

    expect(result.required).toEqual(["name"]);
    expect((result.properties as Record<string, unknown>)["name"]).toEqual({
      type: "string",
      minLength: 1,
    });
  });

  it("handles spread-only object (collapses to single $ref)", () => {
    const result = mapSchemaObject({
      "...": "AuthorityFields",
    });

    expect(result).toEqual({
      $ref: "#/components/schemas/AuthorityFields",
    });
  });
});

describe("mapResource", () => {
  it("expands ssm shorthand with scope", () => {
    expect(mapResource("ssm:/flex/apigw/private/gateway-url:stage")).toEqual({
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    });
  });

  it("expands ssm shorthand without scope", () => {
    expect(mapResource("ssm:/flex/param")).toEqual({
      type: "ssm",
      path: "/flex/param",
    });
  });

  it("expands kms shorthand", () => {
    expect(mapResource("kms:/flex-secret/encryption-key")).toEqual({
      type: "kms",
      path: "/flex-secret/encryption-key",
    });
  });

  it("expands secret shorthand", () => {
    expect(mapResource("secret:/flex-secret/hash-secret")).toEqual({
      type: "secret",
      path: "/flex-secret/hash-secret",
    });
  });

  it("passes through standard object", () => {
    const standard = {
      type: "ssm",
      path: "/flex/param",
      scope: "stage",
    };
    expect(mapResource(standard)).toEqual(standard);
  });
});

describe("mapIntegration", () => {
  it("expands gateway shorthand with target", () => {
    expect(mapIntegration("gateway:dvla:GET /v1/authenticate")).toEqual({
      type: "gateway",
      target: "dvla",
      route: "GET /v1/authenticate",
    });
  });

  it("expands domain shorthand with target", () => {
    expect(mapIntegration("domain:udp:POST /v1/users")).toEqual({
      type: "domain",
      target: "udp",
      route: "POST /v1/users",
    });
  });

  it("expands gateway shorthand without target", () => {
    expect(mapIntegration("gateway:GET /v1/auth")).toEqual({
      type: "gateway",
      route: "GET /v1/auth",
    });
  });

  it("passes through standard object", () => {
    const standard = { type: "gateway", target: "dvla", route: "GET /v1/auth" };
    expect(mapIntegration(standard)).toEqual(standard);
  });
});

describe("mapContract", () => {
  it("expands route body and response shorthand", () => {
    const result = mapContract({
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/v1/items": {
          get: {
            operationId: "get-items",
            response: "ItemList",
          },
          post: {
            operationId: "create-item",
            body: "CreateItem",
          },
        },
      },
    });

    const paths = result.paths as Record<string, Record<string, unknown>>;
    const get = paths["/v1/items"].get as Record<string, unknown>;
    const post = paths["/v1/items"].post as Record<string, unknown>;

    expect(get.response).toBeUndefined();
    expect(get.responses).toBeDefined();
    const getResponses = get.responses as Record<
      string,
      Record<string, unknown>
    >;
    const schema200 = (
      (getResponses["200"].content as Record<string, unknown>)[
        "application/json"
      ] as Record<string, unknown>
    ).schema;
    expect(schema200).toEqual({ $ref: "#/components/schemas/ItemList" });

    expect(post.body).toBeUndefined();
    expect(post.requestBody).toBeDefined();
  });

  it("expands errors shorthand", () => {
    const result = mapContract({
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/v1/items": {
          get: {
            operationId: "get-items",
            response: "Item",
            errors: [404, 502],
          },
        },
      },
    });

    const paths = result.paths as Record<string, Record<string, unknown>>;
    const get = paths["/v1/items"].get as Record<string, unknown>;
    const responses = get.responses as Record<
      string,
      Record<string, unknown>
    >;
    expect(responses["404"]).toEqual({ description: "Not found" });
    expect(responses["502"]).toEqual({
      description: "Upstream service error",
    });
  });

  it("expands schema shorthand strings in components", () => {
    const result = mapContract({
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {},
      components: {
        schemas: {
          Status: "enum:active,inactive",
          Item: {
            "id": "string!",
            "name": "string!",
            "status?": "Status",
          },
        },
      },
    });

    const schemas = (result.components as Record<string, unknown>)
      .schemas as Record<string, Record<string, unknown>>;

    expect(schemas.Status).toEqual({
      type: "string",
      enum: ["active", "inactive"],
    });
    expect(schemas.Item).toEqual({
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        status: { $ref: "#/components/schemas/Status" },
      },
    });
  });

  it("passes through standard OpenAPI unchanged", () => {
    const standard = {
      openapi: "3.1.0",
      info: { title: "Test", version: "1.0.0" },
      paths: {
        "/v1/items": {
          get: {
            operationId: "get-items",
            responses: {
              "200": {
                description: "OK",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/Item" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Item: {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string" },
            },
          },
        },
      },
    };

    const result = mapContract(standard);

    const schemas = (result.components as Record<string, unknown>)
      .schemas as Record<string, Record<string, unknown>>;
    expect(schemas.Item.type).toBe("object");
    expect(schemas.Item.required).toEqual(["id"]);
  });
});

describe("mapPlatformConfig", () => {
  it("expands timeout shorthand", () => {
    const result = mapPlatformConfig({
      common: { access: "isolated", timeout: 30 },
    });

    const common = result.common as Record<string, unknown>;
    expect(common.timeout).toBeUndefined();
    expect(common.function).toEqual({ timeoutSeconds: 30 });
  });

  it("expands resource shorthand strings", () => {
    const result = mapPlatformConfig({
      resources: {
        gwUrl: "ssm:/flex/apigw/private/gateway-url:stage",
        key: "kms:/flex-secret/encryption-key",
      },
    });

    const resources = result.resources as Record<
      string,
      Record<string, unknown>
    >;
    expect(resources.gwUrl).toEqual({
      type: "ssm",
      path: "/flex/apigw/private/gateway-url",
      scope: "stage",
    });
    expect(resources.key).toEqual({
      type: "kms",
      path: "/flex-secret/encryption-key",
    });
  });

  it("expands integration shorthand strings", () => {
    const result = mapPlatformConfig({
      integrations: {
        save: "gateway:udp:POST /v1/items/*",
        get: "gateway:udp:GET /v1/items/*",
      },
    });

    const integrations = result.integrations as Record<
      string,
      Record<string, unknown>
    >;
    expect(integrations.save).toEqual({
      type: "gateway",
      target: "udp",
      route: "POST /v1/items/*",
    });
  });

  it("passes through standard platform config unchanged", () => {
    const standard = {
      common: { access: "isolated", function: { timeoutSeconds: 30 } },
      resources: {
        gwUrl: {
          type: "ssm",
          path: "/flex/apigw/private/gateway-url",
          scope: "stage",
        },
      },
    };

    const result = mapPlatformConfig(standard);
    expect(result.common).toEqual(standard.common);
    expect(result.resources).toEqual(standard.resources);
  });
});
