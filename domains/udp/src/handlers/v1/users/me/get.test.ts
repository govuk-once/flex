import { it } from "@flex/testing";
import {
  createNotification,
  notification,
  secrets,
  userId,
  userProfile,
} from "@tests/fixtures";
import { getPushId } from "@utils/get-push-id";
import { describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("@utils/get-push-id");

describe("GET /v1/users/me", () => {
  const endpoint = "/users/me";

  it("returns 200 with user profile", async ({ http, sdk }) => {
    const notification = createNotification({ consentStatus: "accepted" });

    http
      .gateway("udp")
      .get("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(200, notification);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(vi.mocked(getPushId)).toHaveBeenCalledExactlyOnceWith(
      userId,
      secrets.udpNotificationSecret,
    );
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      userId,
      notifications: notification,
    });
  });

  it("returns 200 and creates a user when the user profile does not exist", async ({
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
    http.gateway("udp").post("/users", { body: userProfile }).reply(204);
    http
      .gateway("udp")
      .post("/notifications", {
        headers: {
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
      })
      .reply(200, notification);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      userId,
      notifications: notification,
    });
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
    http.gateway("udp").post("/users", { body: userProfile }).reply(500);

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
    http.gateway("udp").post("/users", { body: userProfile }).reply(204);
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
