import { it } from "@flex/testing";
import { afterAll, beforeAll, describe, expect, vi } from "vitest";

import { handler } from "./post";

describe("post handler", () => {
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
          notificationsConsented: true,
          analyticsConsented: true,
        }),
      }),
      context.withPairwiseId().create(),
    );

    expect(request).toEqual(
      response.ok(
        {
          preferences: {
            notificationsConsented: true,
            analyticsConsented: true,
            updatedAt: new Date().toISOString(),
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

  it("allows updating one field at a time", async ({
    response,
    eventWithAuthorizer,
    context,
  }) => {
    const request = await handler(
      eventWithAuthorizer.authenticated({
        body: JSON.stringify({ notificationsConsented: true }),
      }),
      context.withPairwiseId().create(),
    );

    expect(request).toEqual(
      response.ok(
        {
          preferences: {
            notificationsConsented: true,
            updatedAt: new Date().toISOString(),
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
          notificationsConsented: true,
          analyticsConsented: true,
        }),
      }),
      context.withPairwiseId().create(),
    );

    expect(result).toEqual(
      response.ok(
        {
          preferences: {
            notificationsConsented: true,
            analyticsConsented: true,
            updatedAt: new Date().toISOString(),
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
