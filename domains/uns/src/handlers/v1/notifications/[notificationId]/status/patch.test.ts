import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { MOCK_NOTIFICATIONS } from "../../../../../data/notifications";
import { handler } from "./patch";

describe("PATCH /v1/notifications/{notificationId}/status", () => {
  const existingId = MOCK_NOTIFICATIONS.at(0)?.NotificationID ?? "";
  const unknownId = "notification-unknown";

  it("returns 202", async ({ privateGatewayEventWithAuthorizer, context }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "PATCH",
        pathParameters: { notificationId: existingId },
        body: JSON.stringify({ Status: "READ" }),
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(202);
  });

  it("returns 404 when the notification ID does not exist", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "PATCH",
        pathParameters: { notificationId: unknownId },
        body: JSON.stringify({ Status: "READ" }),
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(404);
  });
});
