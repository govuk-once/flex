import { it } from "@flex/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./patch";

const mockUpdatePreferences = vi.hoisted(() => vi.fn());

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: "https://execute-api.eu-west-2.amazonaws.com",
    }),
  ),
}));
vi.mock("../../../../client", () => ({
  createUdpDomainClient: vi.fn(() => ({
    gateway: {
      updatePreferences: mockUpdatePreferences,
    },
  })),
}));

describe("Internal PATCH /user handler", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    mockUpdatePreferences.mockReset();
  });

  it.for([
    {
      headers: {
        "Content-Type": "application/json",
        "requesting-service-user-id": "test-pairwise-id",
      },
      body: {
        preferences: { notifications: { consentStatus: "yes" } },
      },
      description: "missing requesting-service-user-id header",
    },
    {
      headers: {
        "Content-Type": "application/json",
        "requesting-service-user-id": "test-pairwise-id",
      },
      body: {
        preferences: { notifications: { consentStatus: "yes" } },
      },
      description: "missing preferences",
    },
  ])(
    "returns 400 for invalid payload: $description",
    async ({ body, headers }, { privateGatewayEvent, context }) => {
      const result = await handler(
        privateGatewayEvent.create({
          httpMethod: "PATCH",
          path: "/user",
          body: JSON.stringify(body),
          headers,
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(expect.objectContaining({ statusCode: 400 }));
      expect(mockUpdatePreferences).not.toHaveBeenCalled();
    },
  );

  it("returns 502 when gateway returns error", async ({
    privateGatewayEvent,
    context,
    response,
  }) => {
    mockUpdatePreferences.mockResolvedValue({
      ok: false,
      error: { status: 500, message: "Upstream error", body: {} },
    });

    const result = await handler(
      privateGatewayEvent.create({
        httpMethod: "PATCH",
        path: "/user",
        body: JSON.stringify({
          preferences: { notifications: { consentStatus: "accepted" } },
        }),
        headers: { "requesting-service-user-id": "test-pairwise-id" },
      }),
      context.withPairwiseId().create(),
    );

    expect(result).toEqual(
      response.internalServerError(undefined, {
        headers: {},
      }),
    );
  });
});
