import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { HttpMethod } from "./http";
import {
  createHttp,
  network,
  PRIVATE_GATEWAY_BASE_URL as BASE_URL,
} from "./http";

beforeAll(() => {
  network.disable();
});

afterAll(() => {
  network.enable();
});

describe("createHttp", () => {
  it("intercepts a gateway request under the default version", async () => {
    using http = createHttp();

    http.gateway("example").get("/test").reply(200, { ok: true });

    const response = await fetch(`${BASE_URL}/gateways/example/v1/test`);

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ ok: true });
  });

  it("intercepts a domain request under the default version", async () => {
    using http = createHttp();

    http.domain("example").get("/test").reply(200, { ok: true });

    const response = await fetch(`${BASE_URL}/domains/example/v1/test`);

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ ok: true });
  });

  it("intercepts a request under a specific version when provided", async () => {
    using http = createHttp();

    http.gateway("example", "v2").get("/test").reply(200);

    const response = await fetch(`${BASE_URL}/gateways/example/v2/test`);

    expect(response.status).toBe(200);
  });

  it("intercepts a request at the provided URL", async () => {
    using http = createHttp();

    http.url("https://example.com").get("/test").reply(200);

    const response = await fetch("https://example.com/test");

    expect(response.status).toBe(200);
  });

  it("intercepts requests against the specified base URL when set", async () => {
    const url = "https://example.com";

    using http = createHttp({ baseUrl: url });

    http.gateway("example").get("/test").reply(200);
    http.domain("example").get("/test").reply(200);

    const gateway = await fetch(`${url}/gateways/example/v1/test`);
    const domain = await fetch(`${url}/domains/example/v1/test`);

    expect(gateway.status).toBe(200);
    expect(domain.status).toBe(200);
  });

  it.each<HttpMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"])(
    'intercepts a "%s" request',
    async (method) => {
      using http = createHttp();
      const methodFn = method.toLowerCase() as Lowercase<HttpMethod>;

      http.gateway("example")[methodFn]("/test").reply(200);

      const response = await fetch(`${BASE_URL}/gateways/example/v1/test`, {
        method,
      });

      expect(response.status).toBe(200);
    },
  );

  it("intercepts a request by matching query parameters", async () => {
    using http = createHttp();

    http
      .gateway("example")
      .get("/test", { query: { page: 1 } })
      .reply(200);

    const response = await fetch(`${BASE_URL}/gateways/example/v1/test?page=1`);

    expect(response.status).toBe(200);
  });

  it("request query is ignored when it is empty", async () => {
    using http = createHttp();

    http.gateway("example").get("/test", { query: {} }).reply(200);

    const response = await fetch(`${BASE_URL}/gateways/example/v1/test`);

    expect(response.status).toBe(200);
  });

  it("intercepts a request by matching headers", async () => {
    using http = createHttp();

    http
      .gateway("example")
      .get("/test", { headers: { "x-custom": "value" } })
      .reply(204);

    const response = await fetch(`${BASE_URL}/gateways/example/v1/test`, {
      headers: { "x-custom": "value" },
    });

    expect(response.status).toBe(204);
  });

  it("intercepts a request by matching body", async () => {
    using http = createHttp();

    http
      .gateway("example")
      .post("/test", { body: { key: "value" } })
      .reply(201);

    const response = await fetch(`${BASE_URL}/gateways/example/v1/test`, {
      method: "POST",
      body: JSON.stringify({ key: "value" }),
    });

    expect(response.status).toBe(201);
  });

  it("replies sequentially when reply is chained", async () => {
    using http = createHttp();

    http.gateway("example").get("/test").reply(200).reply(500);

    const first = await fetch(`${BASE_URL}/gateways/example/v1/test`);
    const second = await fetch(`${BASE_URL}/gateways/example/v1/test`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(500);
  });

  it("throws and lists every request that was not intercepted", () => {
    using http = createHttp();

    http.gateway("example").get("/test").reply(200);
    http.domain("example").get("/test").reply(200);

    expect(() => {
      http[Symbol.dispose]();
    }).toThrow(
      [
        "Failed to intercept HTTP requests:",
        `GET ${BASE_URL}:443/gateways/example/v1/test`,
        `GET ${BASE_URL}:443/domains/example/v1/test`,
      ].join("\n"),
    );
  });

  it("does not throw when all requests were intercepted", async () => {
    using http = createHttp();

    http.gateway("example").get("/test").reply(200);
    http.domain("example").get("/test").reply(200);

    await fetch(`${BASE_URL}/gateways/example/v1/test`);
    await fetch(`${BASE_URL}/domains/example/v1/test`);

    expect(() => {
      http[Symbol.dispose]();
    }).not.toThrow();
  });
});

describe("network", () => {
  it("rejects requests that have not been intercepted", async () => {
    await expect(fetch("https://unknown.com")).rejects.toThrow();
  });
});
