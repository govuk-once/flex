import { describe, expect, it } from "vitest";

import {
  generateDomainConfig,
  generateZodSchemas,
  parseOpenApiSpec,
} from "./generate-domain";

describe("parseOpenApiSpec", () => {
  it("extracts routes from OpenAPI paths", () => {
    const spec = {
      paths: {
        "/v1/items": {
          get: { operationId: "get-items" },
          post: { operationId: "create-item" },
        },
      },
    };

    const routes = parseOpenApiSpec(spec);

    expect(routes).toHaveLength(2);
    expect(routes[0]).toMatchObject({
      method: "GET",
      path: "/v1/items",
      name: "get-items",
    });
    expect(routes[1]).toMatchObject({
      method: "POST",
      path: "/v1/items",
      name: "create-item",
    });
  });

  it("converts OpenAPI path params to Express-style", () => {
    const spec = {
      paths: {
        "/v1/items/{id}/details/{detailId}": {
          get: { operationId: "get-detail" },
        },
      },
    };

    const routes = parseOpenApiSpec(spec);

    expect(routes[0].path).toBe("/v1/items/:id/details/:detailId");
  });

  it("generates operationId from method and path when missing", () => {
    const spec = {
      paths: {
        "/v1/users": {
          get: {},
        },
      },
    };

    const routes = parseOpenApiSpec(spec);

    expect(routes[0].name).toBe("get-v1-users");
  });

  it("extracts body schema ref", () => {
    const spec = {
      paths: {
        "/v1/items": {
          post: {
            operationId: "create-item",
            requestBody: {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CreateItemRequest" },
                },
              },
            },
          },
        },
      },
    };

    const routes = parseOpenApiSpec(spec);

    expect(routes[0].bodySchemaName).toBe("CreateItemRequest");
  });

  it("extracts response schema ref", () => {
    const spec = {
      paths: {
        "/v1/items": {
          get: {
            operationId: "get-items",
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/ItemsResponse" },
                  },
                },
              },
            },
          },
        },
      },
    };

    const routes = parseOpenApiSpec(spec);

    expect(routes[0].responseSchemaName).toBe("ItemsResponse");
  });

  it("returns empty array for spec with no paths", () => {
    const routes = parseOpenApiSpec({});

    expect(routes).toHaveLength(0);
  });

  it("ignores non-HTTP methods like parameters", () => {
    const spec = {
      paths: {
        "/v1/items": {
          get: { operationId: "get-items" },
          parameters: [{ name: "id", in: "path" }],
        },
      },
    };

    const routes = parseOpenApiSpec(spec as never);

    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe("GET");
  });
});

describe("generateZodSchemas", () => {
  it("generates Zod schemas from JSON Schema definitions", () => {
    const schemas = {
      Item: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string" },
        },
      },
    };

    const result = generateZodSchemas(
      schemas as Record<string, Record<string, unknown>>,
      new Set(["Item"]),
    );

    expect(result).toContain('import { z } from "zod"');
    expect(result).toContain("z.object(");
    expect(result).toContain("z.string()");
    expect(result).toContain("export type Item = z.infer<typeof Item>");
  });

  it("resolves $ref pointers within schemas", () => {
    const schemas = {
      Topic: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
        },
      },
      TopicList: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Topic" },
          },
        },
      },
    };

    const result = generateZodSchemas(
      schemas as Record<string, Record<string, unknown>>,
      new Set(["TopicList"]),
    );

    expect(result).not.toContain("z.any()");
    expect(result).toContain("z.object(");
  });

  it("only generates schemas that are in the usedSchemas set", () => {
    const schemas = {
      Used: { type: "object", properties: { a: { type: "string" } } },
      Unused: { type: "object", properties: { b: { type: "string" } } },
    };

    const result = generateZodSchemas(
      schemas as Record<string, Record<string, unknown>>,
      new Set(["Used"]),
    );

    expect(result).toContain("Used");
    expect(result).not.toContain("Unused");
  });
});

describe("generateDomainConfig", () => {
  it("generates a valid domain config string", () => {
    const routes = [
      {
        method: "GET",
        path: "/v1/items",
        name: "get-items",
        access: "public" as const,
      },
    ];

    const result = generateDomainConfig("test-domain", routes);

    expect(result).toContain('import { domain } from "@flex/sdk"');
    expect(result).toContain('name: "test-domain"');
    expect(result).toContain('name: "get-items"');
    expect(result).toContain("GET:");
  });

  it("groups routes by version", () => {
    const routes = [
      {
        method: "GET",
        path: "/v1/items",
        name: "get-items",
        access: "public" as const,
      },
      {
        method: "GET",
        path: "/v2/items",
        name: "get-items-v2",
        access: "public" as const,
      },
    ];

    const result = generateDomainConfig("test-domain", routes);

    expect(result).toContain("v1:");
    expect(result).toContain("v2:");
  });

  it("defaults to v1 when path has no version", () => {
    const routes = [
      {
        method: "GET",
        path: "/items",
        name: "get-items",
        access: "public" as const,
      },
    ];

    const result = generateDomainConfig("test-domain", routes);

    expect(result).toContain("v1:");
  });

  it("includes schema imports when routes have body or response", () => {
    const routes = [
      {
        method: "POST",
        path: "/v1/items",
        name: "create-item",
        access: "public" as const,
        bodySchemaName: "CreateItemRequest",
        responseSchemaName: "ItemResponse",
      },
    ];

    const result = generateDomainConfig("test-domain", routes);

    expect(result).toContain("import {");
    expect(result).toContain("CreateItemRequest,");
    expect(result).toContain("ItemResponse,");
    expect(result).toContain("body: CreateItemRequest,");
    expect(result).toContain("response: ItemResponse,");
  });

  it("groups multiple methods on the same path", () => {
    const routes = [
      {
        method: "GET",
        path: "/v1/items",
        name: "get-items",
        access: "public" as const,
      },
      {
        method: "POST",
        path: "/v1/items",
        name: "create-item",
        access: "public" as const,
      },
    ];

    const result = generateDomainConfig("test-domain", routes);

    const itemsBlock = result.slice(result.indexOf('"/items"'));
    expect(itemsBlock).toContain("GET:");
    expect(itemsBlock).toContain("POST:");
  });
});
