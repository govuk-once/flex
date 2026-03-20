import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { MOCK_NOTIFICATIONS } from "../../../../data/notifications";
import { handler } from "./delete";

describe("DELETE /v1/notifications/{notificationId}", () => {
  const existingId = MOCK_NOTIFICATIONS.at(0)?.NotificationID ?? "";
  const unknownId = "notification-unknown";

  it("returns 204 when a known notification ID is provided", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "DELETE",
        pathParameters: { notificationId: existingId },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(204);
  });

  it("returns 404 when the notification ID does not exist", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "DELETE",
        pathParameters: { notificationId: unknownId },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(404);
  });
});
