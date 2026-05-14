import { describe, expect, it } from "vitest";

import { buildUrl } from "./url";

describe("buildUrl", () => {
  it("joins baseUrl and path with a leading slash", () => {
    const url = buildUrl("https://example.com", "/api/v1");
    expect(url.href).toBe("https://example.com/api/v1");
  });

  it("joins baseUrl and path without a leading slash", () => {
    const url = buildUrl("https://example.com/", "api/v1");
    expect(url.href).toBe("https://example.com/api/v1");
  });

  it("appends trailing slash to baseUrl when missing", () => {
    const url = buildUrl("https://example.com", "/resource");
    expect(url.href).toBe("https://example.com/resource");
  });

  it("does not double-slash when baseUrl already has trailing slash", () => {
    const url = buildUrl("https://example.com/", "/resource");
    expect(url.href).toBe("https://example.com/resource");
  });

  it("appends query params when provided", () => {
    const url = buildUrl("https://example.com", "/search", { q: "test" });
    expect(url.search).toBe("?q=test");
  });

  it("does not set search when params are not provided", () => {
    const url = buildUrl("https://example.com", "/search");
    expect(url.search).toBe("");
  });

  it("handles array query params", () => {
    const url = buildUrl("https://example.com", "/items", {
      ids: ["1", "2"],
    });
    expect(url.search).toContain("ids=1");
    expect(url.search).toContain("ids=2");
  });
});
