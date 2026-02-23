import { it } from "@flex/testing";
import { afterAll, beforeAll, describe, expect, vi } from "vitest";

import { handler } from "./patch";

describe("PATCH /user handler", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns user preferences updated successfully", async ({
    response,
    privateGatewayEvent,
    context,
  }) => {
    const request = await handler(
      privateGatewayEvent.post("/user", {
        body: {
          preferences: { notifications: { consentStatus: "accepted" } },
        },
      }),
      context.withPairwiseId().create(),
    );

    expect(request).toEqual(
      response.ok(
        {
          preferences: {
            notifications: {
              consentStatus: "accepted",
              updatedAt: new Date().toISOString(),
            },
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
  });

  it.for([
    {
      body: { notificationsConsented: "yes", analyticsConsented: true },
      desc: "string instead of boolean",
    },
    {
      body: { notificationsConsented: 1, analyticsConsented: true },
      desc: "number instead of boolean",
    },
    {
      body: { notificationsConsented: null, analyticsConsented: true },
      desc: "null instead of boolean",
    },
    {
      body: {},
      desc: "missing notificationsConsented and analyticsConsented",
    },
  ])(
    "rejects invalid payload: $desc",
    async ({ body }, { privateGatewayEvent, context }) => {
      const result = await handler(
        privateGatewayEvent.post("/user", {
          body: { preferences: body },
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(expect.objectContaining({ statusCode: 400 }));
    },
  );
});
