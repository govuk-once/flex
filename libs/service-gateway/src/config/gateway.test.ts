import { mergeFixture } from "@flex/testing";
import type { DeepPartial } from "@flex/utils";
import { describe, expect, it, vi } from "vitest";

import { buildHandler } from "../handler";
import type { GatewayConfig, GatewayLambda } from "../types";
import { defineGateway } from "./gateway";

vi.mock("../handler");

// TODO: add test fixture

const createGatewayConfig = (overrides: DeepPartial<GatewayConfig> = {}) =>
  mergeFixture<GatewayConfig>(
    {
      name: "example",
      environments: [],
      access: "private",
      resources: {},
      policy: {},
      routes: {
        "GET /v1/example": { name: "exampleRoute" },
      },
    },
    overrides,
  );
const mockGatewayConfig = createGatewayConfig();

const mockGatewayLambda = vi.fn<GatewayLambda>();

describe("defineGateway", () => {
  it("returns the gateway config", () => {
    const { config } = defineGateway(mockGatewayConfig);

    expect(config).toBe(mockGatewayConfig);
  });

  it("passes gateway input to build handler and returns the lambda", () => {
    vi.mocked(buildHandler).mockReturnValue(mockGatewayLambda);

    const mockHandlerInput = { clients: () => ({}), routes: {} };

    const { createHandler } = defineGateway(mockGatewayConfig);

    const result = createHandler(mockHandlerInput);

    expect(buildHandler).toHaveBeenCalledExactlyOnceWith(
      mockGatewayConfig,
      mockHandlerInput,
    );
    expect(result).toBe(mockGatewayLambda);
  });
});
