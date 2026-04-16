import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/notifications", () => {
  const gateway = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/notifications";
  const pushId = "test-push-id";

  const notification = {
    NotificationID: "notification-1",
    NotificationTitle: "Your application has been received",
    NotificationBody:
      "We have received your application and will be in touch shortly.",
    MessageTitle: "Your application has been received",
    MessageBody:
      "We have received your application and will be in touch shortly.",
    DispatchedDateTime: "2026-01-01T00:00:00.000Z",
    Status: "RECEIVED",
  };

  it("returns 200 with notifications mapped successfully", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway.get("/gateway/udp/v1/users/push-id").reply(200, { pushId });
    gateway
      .get("/notifications")
      .query({ pushId })
      .reply(200, [notification]);

    const result = await handler(
      privateGatewayEventWithAuthorizer.get(endpoint),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      NotificationID: "notification-1",
      NotificationTitle: "Your application has been received",
      NotificationBody:
        "We have received your application and will be in touch shortly.",
      MessageTitle: "Your application has been received",
      MessageBody:
        "We have received your application and will be in touch shortly.",
      DispatchedDateTime: "2026-01-01T00:00:00.000Z",
      Status: "RECEIVED",
    });
  });

  it("returns 200 with an empty array when no notifications are returned", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway.get("/gateway/udp/v1/users/push-id").reply(200, { pushId });
    gateway.get("/notifications").reply(200, []);

    const result = await handler(
      privateGatewayEventWithAuthorizer.get(endpoint),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([]);
  });

  it("returns 500 when none successful response is returned", async ({
    privateGatewayEventWithAuthorizer,
    context,
  }) => {
    gateway.get("/gateway/udp/v1/users/push-id").reply(500);
    gateway
      .get("/notifications")
      .reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.get(endpoint),
      context.create(),
    );

    expect(result.statusCode).toBe(500);
  });
});
