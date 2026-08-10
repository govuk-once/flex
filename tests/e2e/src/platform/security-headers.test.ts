import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

const HSTS = "max-age=31536000; includeSubDomains";

describe("security headers", () => {
  describe("API behaviour", () => {
    it("applies the strict response headers to API responses", async ({
      cloudfront,
      authHeader,
    }) => {
      const result = await cloudfront.client.get("/health", {
        headers: authHeader,
      });

      expect(result.headers.get("x-content-type-options")).toBe("nosniff");
      expect(result.headers.get("x-frame-options")).toBe("DENY");
      expect(result.headers.get("referrer-policy")).toBe("no-referrer");
      expect(result.headers.get("strict-transport-security")).toBe(HSTS);
      expect(result.headers.get("x-permitted-cross-domain-policies")).toBe(
        "none",
      );
      expect(result.headers.get("content-security-policy")).toBe(
        "default-src 'self'",
      );
      expect(result.headers.get("cache-control")).toBe("no-store");
    });
  });

  describe("docs behaviour", () => {
    it("applies the shared security headers to docs responses", async ({
      docs,
    }) => {
      const result = await docs.client.get("/docs/");

      expect(result.headers.get("x-content-type-options")).toBe("nosniff");
      expect(result.headers.get("x-frame-options")).toBe("DENY");
      expect(result.headers.get("referrer-policy")).toBe("no-referrer");
      expect(result.headers.get("strict-transport-security")).toBe(HSTS);
      expect(result.headers.get("x-permitted-cross-domain-policies")).toBe(
        "none",
      );
    });

    it("does not let the strict API policy bleed onto docs responses", async ({
      docs,
    }) => {
      const result = await docs.client.get("/docs/");

      expect(result.headers.get("content-security-policy")).toBeNull();
      expect(result.headers.get("cache-control")).not.toBe("no-store");
    });
  });
});
