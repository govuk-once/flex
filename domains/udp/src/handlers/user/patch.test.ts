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
    eventWithAuthorizer,
    context,
  }) => {
    const request = await handler(
      eventWithAuthorizer.authenticated({
        body: JSON.stringify({
          notifications_consented: true,
          analytics_consented: true,
        }),
      }),
      context.withPairwiseId().create(),
    );

    expect(request).toEqual(
      response.ok(
        {
          preferences: {
            notifications_consented: true,
            analytics_consented: true,
            updated_at: new Date().toISOString(),
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
      body: { notifications_consented: "yes", analytics_consented: true },
      desc: "string instead of boolean",
    },
    {
      body: { notifications_consented: 1, analytics_consented: true },
      desc: "number instead of boolean",
    },
    {
      body: { notifications_consented: null, analytics_consented: true },
      desc: "null instead of boolean",
    },
    {
      body: { notifications_consented: true },
      desc: "missing analytics_consented",
    },
    {
      body: { analytics_consented: true },
      desc: "missing notifications_consented",
    },
    {
      body: {},
      desc: "missing notifications_consented and analytics_consented",
    },
  ])(
    "rejects invalid payload: $desc",
    async ({ body }, { eventWithAuthorizer, context }) => {
      const result = await handler(
        eventWithAuthorizer.authenticated({ body: JSON.stringify(body) }),
        context.withPairwiseId().create(),
      );

      expect(result.statusCode).toBe(400);
    },
  );

  it("parses JSON body even with non-standard Content-Type casing", async ({
    response,
    eventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      eventWithAuthorizer.authenticated({
        headers: { "CoNtEnT-TyPe": "application/json" },
        body: JSON.stringify({
          notifications_consented: true,
          analytics_consented: true,
        }),
      }),
      context.withPairwiseId().create(),
    );

    expect(result).toEqual(
      response.ok(
        {
          preferences: {
            notifications_consented: true,
            analytics_consented: true,
            updated_at: new Date().toISOString(),
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
});
