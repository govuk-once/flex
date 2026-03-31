import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { MOCK_NOTIFICATIONS } from "../../../data/notifications";
import { handler } from "./get";

describe("GET /v1/notifications", () => {
  it("returns 200 with all mock notifications", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.get("/notifications"),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as unknown[];
    expect(body).toHaveLength(MOCK_NOTIFICATIONS.length);
  });

  it("returns the correct notification shape", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.get("/notifications"),
      context.create(),
    );

    const body = JSON.parse(result.body) as Record<string, unknown>[];
    expect(body[0]).toMatchObject({
      NotificationID: expect.any(String) as unknown,
      NotificationTitle: expect.any(String) as unknown,
      NotificationBody: expect.any(String) as unknown,
      MessageTitle: expect.any(String) as unknown,
      MessageBody: expect.any(String) as unknown,
      DispatchedDateTime: expect.any(String) as unknown,
    });
  });
});
