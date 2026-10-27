import { describe, expect, it } from "vitest";

import { DomainConfigSchema } from "./schema";

function configWithIntegration(integration: Record<string, unknown>) {
  return {
    name: "test",
    routes: { v1: { "/items": { GET: { public: { name: "list-items" } } } } },
    integrations: {
      upstream: { type: "gateway", route: "GET /v1/items", ...integration },
    },
  };
}

describe("DomainConfigSchema", () => {
  describe("integration retry options", () => {
    it("keeps retryAttempts and maxRetryDelay", () => {
      const parsed = DomainConfigSchema.parse(
        configWithIntegration({ retryAttempts: 3, maxRetryDelay: 500 }),
      );

      expect(parsed.integrations?.upstream).toMatchObject({
        retryAttempts: 3,
        maxRetryDelay: 500,
      });
    });

    it("allows both to be omitted", () => {
      const parsed = DomainConfigSchema.parse(configWithIntegration({}));

      expect(parsed.integrations?.upstream).not.toHaveProperty("retryAttempts");
      expect(parsed.integrations?.upstream).not.toHaveProperty("maxRetryDelay");
    });

    it.for([
      { field: "retryAttempts", value: 0 },
      { field: "retryAttempts", value: 5 },
      { field: "maxRetryDelay", value: 10 },
      { field: "maxRetryDelay", value: 1000 },
    ])("accepts $field: $value", ({ field, value }) => {
      const result = DomainConfigSchema.safeParse(
        configWithIntegration({ [field]: value }),
      );

      expect(result.success).toBe(true);
    });

    it.for([
      { field: "retryAttempts", value: -1 },
      { field: "retryAttempts", value: 1.5 },
      { field: "retryAttempts", value: 6 },
      { field: "maxRetryDelay", value: 5 },
      { field: "maxRetryDelay", value: 5000 },
    ])("rejects $field: $value", ({ field, value }) => {
      const result = DomainConfigSchema.safeParse(
        configWithIntegration({ [field]: value }),
      );

      expect(result.success).toBe(false);
    });
  });
});
