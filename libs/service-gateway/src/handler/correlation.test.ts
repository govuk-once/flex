import type { PlatformFixture } from "@flex/testing";
import { it } from "@flex/testing";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";

import { createRestClient } from "../client/adapter/rest";
import type { GatewayConfig } from "../types";
import { buildHandler } from ".";

// Exercises the real handler, REST client and flexFetch together, stubbing
// only the network, to prove the inbound id reaches the upstream request
describe("correlation id propagation", () => {
  const config = {
    name: "example",
    environments: [],
    access: "private",
    resources: {},
    policy: {},
    routes: { "GET /v1/path": { name: "example" } },
  } as const satisfies GatewayConfig;

  const gateway = buildHandler(config, {
    clients: () => ({
      api: createRestClient({
        baseUrl: "https://upstream.test",
        auth: { type: "public" },
      }),
    }),
    routes: {
      "GET /v1/path": ({ clients }) => clients.api.get("/upstream"),
    },
  });

  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockImplementation(() =>
      Promise.resolve(Response.json({ result: "ok" })),
    );
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  function invoke(platform: PlatformFixture, headers: Record<string, string>) {
    const event = platform.gatewayEvent.get("/v1/path");

    return gateway(
      { ...event, headers: { ...event.headers, ...headers } },
      platform.context(),
    );
  }

  function upstreamHeaders() {
    const [, init] = fetchSpy.mock.calls[0] ?? [];
    return new Headers(init?.headers);
  }

  it("forwards the inbound correlation id to the upstream API", async ({
    platform,
  }) => {
    const result = await invoke(platform, {
      "x-correlation-id": "abc-123",
    });

    expect(result).toMatchObject({ statusCode: 200 });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(upstreamHeaders().get("x-correlation-id")).toBe("abc-123");
  });

  it("does not send a correlation id when none is received", async ({
    platform,
  }) => {
    await invoke(platform, {});

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(upstreamHeaders().get("x-correlation-id")).toBeNull();
  });

  it("keeps concurrent invocations isolated", async ({ platform }) => {
    await Promise.all([
      invoke(platform, { "x-correlation-id": "first" }),
      invoke(platform, { "x-correlation-id": "second" }),
    ]);

    const sent = fetchSpy.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get("x-correlation-id"),
    );

    sent.sort();

    expect(sent).toStrictEqual(["first", "second"]);
  });
});
