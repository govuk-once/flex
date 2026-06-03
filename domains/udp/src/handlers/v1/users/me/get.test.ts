import { it } from "@flex/testing";
import { pushId, userId } from "@tests/fixtures";
import { getPushId } from "@utils/get-push-id";
import { describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("@utils/get-push-id");

describe("GET /v1/users/me", () => {
  const endpoint = "/users/me";

  const secrets = { udpNotificationSecret: "test-notification-secret" }; // pragma: allowlist secret

  const user = { userId, pushId };

  it("returns 200 with user profile", async ({ http, sdk }) => {
    const notifications = { consentStatus: "accepted", pushId };

    http
      .gateway("udp")
      .get("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(200, notifications);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(vi.mocked(getPushId)).toHaveBeenCalledExactlyOnceWith(
      userId,
      secrets.udpNotificationSecret,
    );
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({ userId, notifications });
  });

  it("returns 200 and creates a user when the user profile does not exist", async ({
    http,
    sdk,
  }) => {
    const notifications = { consentStatus: "unknown", pushId };

    http
      .gateway("udp")
      .get("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(404);
    http.gateway("udp").post("/users", { body: user }).reply(204);
    http
      .gateway("udp")
      .post("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(200, notifications);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({ userId, notifications });
  });

  it("returns 502 when the UDP get notifications integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(500);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });

  it("returns 502 when the UDP create user integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(404);
    http.gateway("udp").post("/users", { body: user }).reply(500);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });

  it("returns 502 when the UDP create notifications integration fails", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(404);
    http.gateway("udp").post("/users", { body: user }).reply(204);
    http
      .gateway("udp")
      .post("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(500);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });
});
