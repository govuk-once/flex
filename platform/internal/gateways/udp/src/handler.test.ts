import { context } from "@flex/testing";
import { describe, expect, it, vi } from "vitest";

import { handler } from "./handler";

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() => Promise.resolve({ AWS_REGION: "eu-west-2" })),
}));

describe("UDP connector handler", () => {
  const baseEvent = {
    version: "2.0",
    routeKey: "POST /internal/gateways/udp",
    rawPath: "/internal/gateways/udp",
    rawQueryString: "",
    headers: {},
    requestContext: {} as unknown,
    isBase64Encoded: false,
  };

  it("returns 200 with connector response when body is valid", async () => {
    const event = {
      ...baseEvent,
      body: JSON.stringify({ userId: "user-123" }),
    };

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.["Content-Type"]).toBe("application/json");
    const body = JSON.parse(result.body ?? "{}");
    expect(body).toMatchObject({
      ok: true,
      gateway: "udp",
      message: expect.stringContaining("user-123"),
    });
  });

  it("returns 200 with default message when body is empty object", async () => {
    const event = {
      ...baseEvent,
      body: JSON.stringify({}),
    };

    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body ?? "{}");
    expect(body).toMatchObject({ ok: true, gateway: "udp" });
  });

  it("returns 400 when body is invalid JSON", async () => {
    const event = {
      ...baseEvent,
      body: "not json",
    };

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("Invalid JSON");
  });

  it("returns 400 when body fails schema validation", async () => {
    const event = {
      ...baseEvent,
      body: JSON.stringify({ userId: 123 }),
    };

    const result = await handler(event, context);

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("Validation failed");
  });
});
