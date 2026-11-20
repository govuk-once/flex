import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v0/correlation", () => {
  const endpoint = "/correlation";
  const correlationId = "fea49641-a847-46f4-98b4-7c604db826c2";

  it("forwards the inbound correlation id to the private route", async ({
    http,
    sdk,
  }) => {
    http
      .domain("example", "v0")
      .get("/correlation", { headers: { "x-correlation-id": correlationId } })
      .reply(200, { correlationId });

    const result = await handler(
      sdk.event.get(endpoint, {
        headers: { "x-correlation-id": correlationId },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      correlationId,
      forwardedCorrelationId: correlationId,
    });
  });

  it("returns 502 when the private route fails", async ({ http, sdk }) => {
    http.domain("example", "v0").get("/correlation").reply(500);

    const result = await handler(
      sdk.event.get(endpoint, {
        headers: { "x-correlation-id": correlationId },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
