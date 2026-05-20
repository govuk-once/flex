import { describe, expect, it, vi } from "vitest";

import { createPublicFetch } from "./createPublicFetch";

vi.mock("@flex/flex-fetch", () => ({
  flexFetch: vi
    .fn()
    .mockReturnValue({ request: Promise.resolve(new Response()) }),
}));

import { flexFetch } from "@flex/flex-fetch";

describe("createPublicFetch", () => {
  it("prepends baseUrl for relative URLs", () => {
    const fetch = createPublicFetch({ baseUrl: "https://api.example.com" });
    fetch("/v1/resource");

    expect(flexFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/resource",
      expect.objectContaining({}),
    );
  });

  it("does not prepend baseUrl for absolute URLs", () => {
    const fetch = createPublicFetch({ baseUrl: "https://api.example.com" });
    fetch("https://other.host.test/v1/resource");

    expect(flexFetch).toHaveBeenCalledWith(
      "https://other.host.test/v1/resource",
      expect.objectContaining({}),
    );
  });

  it("sets Content-Type: application/json by default", () => {
    const fetch = createPublicFetch({ baseUrl: "https://api.example.com" });
    fetch("/v1/resource");

    expect(flexFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("merges caller headers (plain object) after Content-Type", () => {
    const fetch = createPublicFetch({ baseUrl: "https://api.example.com" });
    fetch("/v1/resource", { headers: { "X-API-KEY": "secret" } });

    expect(flexFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "Content-Type": "application/json", "X-API-KEY": "secret" },
      }),
    );
  });

  it("merges caller headers (Headers instance)", () => {
    const fetch = createPublicFetch({ baseUrl: "https://api.example.com" });
    const headers = new Headers({ "X-Custom": "value" });
    fetch("/v1/resource", { headers });

    expect(flexFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "Content-Type": "application/json", "x-custom": "value" },
      }),
    );
  });

  it("merges caller headers (array of pairs)", () => {
    const fetch = createPublicFetch({ baseUrl: "https://api.example.com" });
    fetch("/v1/resource", { headers: [["X-Request-Id", "123"]] });

    expect(flexFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "Content-Type": "application/json", "X-Request-Id": "123" },
      }),
    );
  });

  it("defaults retryAttempts to 3 when not provided", () => {
    const fetch = createPublicFetch({ baseUrl: "https://api.example.com" });
    fetch("/v1/resource");

    expect(flexFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ retryAttempts: 3 }),
    );
  });

  it("uses retryAttempts from options when provided", () => {
    const fetch = createPublicFetch({ baseUrl: "https://api.example.com" });
    fetch("/v1/resource", { retryAttempts: 0 });

    expect(flexFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ retryAttempts: 0 }),
    );
  });
});
