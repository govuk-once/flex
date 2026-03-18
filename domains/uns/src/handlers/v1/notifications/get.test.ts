import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { MOCK_NOTIFICATIONS } from "../../../data/notifications";
import { handler } from "./get";

describe("GET /v1/notifications", () => {
  const validApiKey = "mock-api-key";
  const existingUserId = "user-ABC";

  it("returns 200 with all mock notifications when authorised", async ({
    event,
  }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        queryStringParameters: { externalUserId: existingUserId },
      }),
      context,
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string) as unknown[];
    expect(body).toHaveLength(MOCK_NOTIFICATIONS.length);
  });

  it("returns the correct notification shape", async ({ event }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        queryStringParameters: { externalUserId: existingUserId },
      }),
      context,
    );

    const body = JSON.parse(result.body as string) as Record<string, unknown>[];
    expect(body[0]).toMatchObject({
      NotificationID: expect.any(String) as unknown,
      NotificationTitle: expect.any(String) as unknown,
      NotificationBody: expect.any(String) as unknown,
      MessageTitle: expect.any(String) as unknown,
      MessageBody: expect.any(String) as unknown,
      DispatchedAt: expect.any(String) as unknown,
    });
  });

  it("returns 400 when externalUserId is missing", async ({ event }) => {
    const result = await handler(
      event.create({ headers: { "x-api-key": validApiKey } }),
      context,
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 401 when x-api-key is missing", async ({ event }) => {
    const result = await handler(
      event.create({
        queryStringParameters: { externalUserId: existingUserId },
      }),
      context,
    );

    expect(result.statusCode).toBe(401);
  });

  it("returns 401 when x-api-key is invalid", async ({ event }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": "wrong-key" },
        queryStringParameters: { externalUserId: existingUserId },
      }),
      context,
    );

    expect(result.statusCode).toBe(401);
  });
});
