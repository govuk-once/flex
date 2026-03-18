import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { MOCK_NOTIFICATIONS } from "../../../../../data/notifications";
import { handler } from "./patch";

describe("PATCH /v1/notifications/{notificationId}/status", () => {
  const validApiKey = "mock-api-key";
  const existingId = MOCK_NOTIFICATIONS.at(0)?.NotificationID ?? "";
  const unknownId = "00000000-0000-0000-0000-000000000000";

  it("returns 202 when a valid patch request is made", async ({ event }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        pathParameters: { notificationId: existingId },
        body: JSON.stringify({ Status: "READ" }),
      }),
      context,
    );

    expect(result.statusCode).toBe(202);
  });

  it("returns 202 when Status is MARKED_AS_UNREAD", async ({ event }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        pathParameters: { notificationId: existingId },
        body: JSON.stringify({ Status: "MARKED_AS_UNREAD" }),
      }),
      context,
    );

    expect(result.statusCode).toBe(202);
  });

  it("returns 202 when Status is RECEIVED", async ({ event }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        pathParameters: { notificationId: existingId },
        body: JSON.stringify({ Status: "RECEIVED" }),
      }),
      context,
    );

    expect(result.statusCode).toBe(202);
  });

  it("returns 400 when Status is invalid", async ({ event }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        pathParameters: { notificationId: existingId },
        body: JSON.stringify({ Status: "INVALID_STATUS" }),
      }),
      context,
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 400 when body is missing", async ({ event }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        pathParameters: { notificationId: existingId },
      }),
      context,
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 400 when notificationId is missing", async ({ event }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        body: JSON.stringify({ Status: "READ" }),
      }),
      context,
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 404 when the notification ID does not exist", async ({
    event,
  }) => {
    const result = await handler(
      event.create({
        headers: { "x-api-key": validApiKey },
        pathParameters: { notificationId: unknownId },
        body: JSON.stringify({ Status: "READ" }),
      }),
      context,
    );

    expect(result.statusCode).toBe(404);
  });
});
