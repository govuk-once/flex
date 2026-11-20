import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get.private";

describe("GET /v0/correlation [private]", () => {
  const endpoint = "/correlation";

  it("returns 200 with the received correlation id", async ({ sdk }) => {
    const result = await handler(
      sdk.event.get(endpoint, {
        headers: { "x-correlation-id": "correlation-value" },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      correlationId: "correlation-value",
    });
  });

  it("returns null when no correlation id is received", async ({ sdk }) => {
    const result = await handler(sdk.event.get(endpoint), sdk.context());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({ correlationId: null });
  });
});
