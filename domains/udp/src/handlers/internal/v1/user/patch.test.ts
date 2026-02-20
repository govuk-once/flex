import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./patch";

describe("PATCH /user handler", () => {
  it("returns user preferences updated successfully", async ({
    response,
    eventWithAuthorizer,
    context,
  }) => {
    const request = await handler(
      eventWithAuthorizer.authenticated({
        body: JSON.stringify({
          preferences: {
            notifications: {
              consentStatus: "accepted",
            },
          },
        }),
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
    async ({ body }, { eventWithAuthorizer, context }) => {
      const result = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({ preferences: body }),
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(expect.objectContaining({ statusCode: 400 }));
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
          preferences: {
            notifications: {
              consentStatus: "accepted",
            },
          },
        }),
      }),
      context.withPairwiseId().create(),
    );

    expect(result).toEqual(
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
});
