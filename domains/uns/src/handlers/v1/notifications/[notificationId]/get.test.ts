import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { MOCK_NOTIFICATIONS } from "../../../../data/notifications";
import { handler } from "./get";

describe("GET /v1/notifications/{notificationId}", () => {
  const existingId = MOCK_NOTIFICATIONS.at(0)?.NotificationID ?? "";
  const unknownId = "notification-unknown";

  it("returns 200 with the matching notification", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { notificationId: existingId },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as {
      NotificationID: string;
    };
    expect(body.NotificationID).toBe(existingId);
  });

  it("returns 404 when the notification ID does not exist", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { notificationId: unknownId },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(404);
  });
});
