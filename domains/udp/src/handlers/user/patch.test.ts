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
          notifications_consented: true,
        }),
      }),
      context.withPairwiseId().create(),
    );

    expect(request).toEqual(
      response.ok({
        preferences: {
          notifications_consented: true,
          updated_at: new Date().toISOString(),
        },
      }),
    );
  });

  it("validates the request against the schema", async ({
    response,
    eventWithAuthorizer,
    context,
  }) => {
    const request = await handler(
      eventWithAuthorizer.authenticated({
        body: JSON.stringify({
          notifications_consented: true,
        }),
      }),
      context.withPairwiseId().create(),
    );

    expect(request).toEqual(
      response.ok({
        preferences: {
          notifications_consented: true,
          updated_at: new Date().toISOString(),
        },
      }),
    );
  });
});
