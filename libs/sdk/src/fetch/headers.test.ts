import { describe, expect, it } from "vitest";

import { runWithCorrelationId } from "../correlation";
import { buildHeaders } from "./headers";

describe("buildHeaders", () => {
  describe("seeding from the url", () => {
    it("copies headers from a Request", () => {
      const request = new Request("https://example.test", {
        headers: { "x-foo": "from-request", authorization: "Bearer token" },
      });

      const headers = buildHeaders(request);

      expect(headers.get("x-foo")).toBe("from-request");
      expect(headers.get("authorization")).toBe("Bearer token");
    });

    it("does not seed headers when given a string url", () => {
      const headers = buildHeaders("https://example.test");

      expect([...headers.keys()]).toHaveLength(0);
    });

    it("does not seed headers when given a URL", () => {
      const headers = buildHeaders(new URL("https://example.test"));

      expect([...headers.keys()]).toHaveLength(0);
    });
  });

  describe("merging option headers", () => {
    it("adds option headers from a plain object", () => {
      const headers = buildHeaders("https://example.test", {
        "content-type": "application/json",
      });

      expect(headers.get("content-type")).toBe("application/json");
    });

    it("accepts a Headers instance as option headers", () => {
      const headers = buildHeaders(
        "https://example.test",
        new Headers({ "x-custom": "value" }),
      );

      expect(headers.get("x-custom")).toBe("value");
    });

    it("accepts an array of tuples as option headers", () => {
      const headers = buildHeaders("https://example.test", [
        ["x-header-1", "1"],
        ["x-header-2", "2"],
      ]);

      expect(headers.get("x-header-1")).toBe("1");
      expect(headers.get("x-header-2")).toBe("2");
    });

    it("lets option headers override the Request's headers", () => {
      const request = new Request("https://example.test", {
        headers: { "x-shared": "from-request" },
      });

      const headers = buildHeaders(request, { "x-shared": "from-options" });

      expect(headers.get("x-shared")).toBe("from-options");
    });
  });

  describe("correlation id injection", () => {
    const withId = (fn: () => Headers) => runWithCorrelationId("abc-123", fn);

    it("injects the correlation id from the current context", () => {
      const headers = withId(() => buildHeaders("https://example.test"));

      expect(headers.get("x-correlation-id")).toBe("abc-123");
    });

    it("overrides a correlation id supplied via option headers", () => {
      const headers = withId(() =>
        buildHeaders("https://example.test", {
          "X-Correlation-Id": "from-options",
        }),
      );

      expect(headers.get("x-correlation-id")).toBe("abc-123");
    });

    it("overrides a correlation id carried on the Request", () => {
      const request = new Request("https://example.test", {
        headers: { "x-correlation-id": "from-request" },
      });

      const headers = withId(() => buildHeaders(request));

      expect(headers.get("x-correlation-id")).toBe("abc-123");
    });

    it("does not set a correlation id when the context has none", () => {
      const headers = runWithCorrelationId(undefined, () =>
        buildHeaders("https://example.test"),
      );

      expect(headers.get("x-correlation-id")).toBeNull();
    });

    it("leaves caller headers untouched outside a correlation context", () => {
      const headers = buildHeaders("https://example.test", {
        "x-correlation-id": "from-options",
      });

      expect(headers.get("x-correlation-id")).toBe("from-options");
    });
  });
});
