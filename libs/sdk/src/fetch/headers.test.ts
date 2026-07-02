import { logger } from "@flex/logging";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRouteStore } from "../route";
import { buildHeaders } from "./headers";

vi.mock("../route", () => ({
  getRouteStore: vi.fn(),
}));

vi.mock("@flex/logging", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

const mockedGetRouteStore = vi.mocked(getRouteStore);

function stubRouteStore(headers?: Record<string, string>) {
  mockedGetRouteStore.mockReturnValue({
    headers,
  } as ReturnType<typeof getRouteStore>);
}

function stubNoRouteContext() {
  mockedGetRouteStore.mockImplementation(() => {
    throw new Error("No route store in this async context");
  });
}

describe("buildHeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubRouteStore({});
  });

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
    it("injects the correlation id from the route store", () => {
      stubRouteStore({ "x-correlation-id": "abc-123" });

      const headers = buildHeaders("https://example.test");

      expect(headers.get("x-correlation-id")).toBe("abc-123");
    });

    it("overrides a correlation id supplied via option headers", () => {
      stubRouteStore({ "x-correlation-id": "from-store" });

      const headers = buildHeaders("https://example.test", {
        "x-correlation-id": "from-options",
      });

      expect(headers.get("x-correlation-id")).toBe("from-store");
    });

    it("overrides a correlation id carried on the Request", () => {
      stubRouteStore({ "x-correlation-id": "from-store" });
      const request = new Request("https://example.test", {
        headers: { "x-correlation-id": "from-request" },
      });

      const headers = buildHeaders(request);

      expect(headers.get("x-correlation-id")).toBe("from-store");
    });

    it("does not set a correlation id when the store has no headers", () => {
      stubRouteStore();

      const headers = buildHeaders("https://example.test", undefined);

      expect(headers.get("x-correlation-id")).toBeNull();
    });

    it("does not set a correlation id when the header is absent from the store", () => {
      stubRouteStore({ "x-other": "value" });

      const headers = buildHeaders("https://example.test");

      expect(headers.get("x-correlation-id")).toBeNull();
    });
  });

  describe("outside a route context", () => {
    it("warns and skips injection when the store is unavailable", () => {
      stubNoRouteContext();

      const headers = buildHeaders("https://example.test", {
        "content-type": "application/json",
      });

      expect(headers.get("content-type")).toBe("application/json");
      expect(headers.get("x-correlation-id")).toBeNull();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("outside of a route context"),
      );
    });
  });
});
