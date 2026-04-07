import { describe, expect, it } from "vitest";
import { z } from "zod";

import { generateOpenApiSpec } from "./generate-openapi";

describe("generateOpenApiSpec", () => {
  it("generates a valid OpenAPI spec from a domain config", () => {
    const BodySchema = z.object({
      local_authority: z.object({
        name: z.string().min(1),
        homepage_url: z.url(),
        tier: z.enum(["county", "district", "unitary"]),
        slug: z.string().min(1),
        parent: z
          .object({
            name: z.string().min(1),
            homepage_url: z.url(),
            tier: z.enum(["county", "district", "unitary"]),
            slug: z.string().min(1),
          })
          .optional(),
      }),
    });

    const ResponseSchema = BodySchema;

    const config = {
      name: "local-council",
      common: {
        access: "isolated" as const,
        function: { timeoutSeconds: 30 },
      },
      routes: {
        v1: {
          "/local-council/:id": {
            POST: {
              private: {
                name: "upsert-local-authority",
                body: BodySchema,
              },
            },
            GET: {
              private: {
                name: "get-local-authority",
                response: ResponseSchema,
              },
            },
          },
        },
      },
    };

    const spec = generateOpenApiSpec(config);

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("local-council API");

    // Check paths exist
    expect(spec.paths).toHaveProperty("/v1/local-council/{id}");

    const path = (spec.paths ?? {})["/v1/local-council/{id}"] ?? {};

    // POST route
    expect(path.post).toBeDefined();
    expect(path.post?.operationId).toBe("upsert-local-authority");
    expect(path.post?.tags).toEqual(["private"]);
    expect(path.post?.requestBody).toBeDefined();

    // GET route
    expect(path.get).toBeDefined();
    expect(path.get?.operationId).toBe("get-local-authority");
    expect(path.get?.tags).toEqual(["private"]);
    expect((path.get?.responses ?? {})["200"]).toBeDefined();

    // Path params
    expect(path.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "id",
          in: "path",
          required: true,
        }),
      ]),
    );
  });

  it("generates spec for a domain with public and private routes", () => {
    const BodySchema = z.object({ userId: z.string().min(1) });
    const ResponseSchema = z.object({
      userId: z.string().min(1),
      status: z.enum(["active", "inactive"]),
    });

    const config = {
      name: "udp",
      routes: {
        v1: {
          "/users": {
            GET: {
              public: {
                name: "get-user",
                response: ResponseSchema,
              },
            },
            POST: {
              private: {
                name: "create-user",
                body: BodySchema,
              },
            },
          },
        },
      },
    };

    const spec = generateOpenApiSpec(config);

    const path = (spec.paths ?? {})["/v1/users"] ?? {};

    expect(path.get?.tags).toEqual(["public"]);
    expect(path.post?.tags).toEqual(["private"]);
  });

  it("includes custom headers in the spec", () => {
    const config = {
      name: "test-domain",
      routes: {
        v1: {
          "/resource": {
            GET: {
              private: {
                name: "get-resource",
                headers: {
                  userId: { name: "User-Id", required: true },
                },
              },
            },
          },
        },
      },
    };

    const spec = generateOpenApiSpec(config);
    const path = (spec.paths ?? {})["/v1/resource"] ?? {};

    expect(path.get?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "User-Id",
          in: "header",
          required: true,
        }),
      ]),
    );
  });

  it("handles routes without body or response schemas", () => {
    const config = {
      name: "simple",
      routes: {
        v1: {
          "/action": {
            POST: {
              private: {
                name: "do-action",
              },
            },
          },
        },
      },
    };

    const spec = generateOpenApiSpec(config);
    const path = (spec.paths ?? {})["/v1/action"] ?? {};

    expect(path.post?.requestBody).toBeUndefined();
    expect((path.post?.responses ?? {})["204"]).toEqual({
      description: "No content",
    });
  });
});
