import type {
  EventBusDownstream,
  GatewayConfig,
  GatewayDownstream,
  RemoteApiDownstream,
} from "@types";
import { describe, expect, it, vi } from "vitest";

import { createEventBusClient, createRemoteApiClient } from "./adapters";
import { createDownstreamClient } from "./downstream-client";

vi.mock("./adapters");

const resources = {
  consumerConfig: {
    type: "secret",
    path: "/example/path",
    env: "EXAMPLE_ENV",
  },
} satisfies GatewayConfig["resources"];

const buildConfig = (downstream: GatewayDownstream) =>
  ({
    name: "example",
    environments: [],
    access: "private",
    downstream,
    resources,
    routes: {},
  }) satisfies GatewayConfig;

describe("createDownstreamClient", () => {
  it('returns a "remote-api" client', async () => {
    const client = {
      config: {},
      request: vi.fn(),
    };

    const downstream: RemoteApiDownstream = {
      type: "remote-api",
      ref: "consumerConfig",
      auth: { type: "public" },
    };

    vi.mocked(createRemoteApiClient).mockResolvedValue(client);

    const result = await createDownstreamClient(buildConfig(downstream));

    expect(createRemoteApiClient).toHaveBeenCalledExactlyOnceWith(
      downstream,
      resources,
    );
    expect(result).toBe(client);
  });

  it('returns an "event-bus" client', async () => {
    const client = {
      config: undefined,
      request: vi.fn(),
    };

    vi.mocked(createEventBusClient).mockResolvedValue(client);

    const downstream: EventBusDownstream = {
      type: "event-bus",
      ref: "bus",
      auth: { type: "public" },
    };

    const result = await createDownstreamClient(buildConfig(downstream));

    expect(createEventBusClient).toHaveBeenCalledExactlyOnceWith(
      "example",
      downstream,
    );
    expect(result).toBe(client);
  });

  it("throws when an unknown downstream is provided", () => {
    expect(() =>
      createDownstreamClient({ type: "unknown" } as never),
    ).toThrow();
  });
});
