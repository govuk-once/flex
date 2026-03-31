import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { MOCK_NOTIFICATIONS } from "../../../../data/notifications";
import { handler } from "./get";

describe("GET /v1/notifications/{pushId}", () => {
  const existingId = MOCK_NOTIFICATIONS.at(0)?.PushId ?? "";
  const unknownId = "notification-unknown";

  it("returns 200 with the matching notification", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { pushId: existingId },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as {
      PushId: string;
    };
    expect(body.PushId).toBe(existingId);
  });

  it("returns 404 when the push IT does not exist", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { pushId: unknownId },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(404);
  });
});
