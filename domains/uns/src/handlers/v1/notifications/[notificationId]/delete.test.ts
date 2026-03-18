import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { MOCK_NOTIFICATIONS } from "../../../../data/notifications";
import { handler } from "./delete";

describe("DELETE /v1/notifications/{notificationId}", () => {
  const validApiKey = "mock-api-key";
  const existingId = MOCK_NOTIFICATIONS.at(0)?.NotificationID ?? "";
  const unknownId = "00000000-0000-0000-0000-000000000000";

  it("returns 204 when a known notification ID is provided", async ({
    event,
  }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        pathParameters: { notificationId: existingId },
      }),
      context,
    );

    expect(result.statusCode).toBe(204);
  });

  it("returns 404 when the notification ID does not exist", async ({
    event,
  }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        pathParameters: { notificationId: unknownId },
      }),
      context,
    );

    expect(result.statusCode).toBe(404);
  });

  it("returns 400 when notificationId is missing", async ({ event }) => {
    const result = await handler(
      event.create({ headers: { "x-api-key": validApiKey } }),
      context,
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 401 when x-api-key is missing", async ({ event }) => {
    const result = await handler(
      event.create({ pathParameters: { notificationId: existingId } }),
      context,
    );

    expect(result.statusCode).toBe(401);
  });

  it("returns 401 when x-api-key is invalid", async ({ event }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": "wrong-key" },
        pathParameters: { notificationId: existingId },
      }),
      context,
    );

    expect(result.statusCode).toBe(401);
  });
});
