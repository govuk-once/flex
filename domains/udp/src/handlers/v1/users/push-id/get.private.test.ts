import { it } from "@flex/testing";
import { pushId, secrets, userId } from "@tests/fixtures";
import { getPushId } from "@utils/get-push-id";
import { describe, expect, vi } from "vitest";

import { handler } from "./get.private";

vi.mock("@utils/get-push-id");

describe("GET /v1/users/push-id [private]", () => {
  const endpoint = "/users/push-id";

  it("returns 200 with UNS push ID", async ({ sdk }) => {
    vi.mocked(getPushId).mockReturnValue(pushId);

    const result = await handler(
      sdk.event.get(endpoint, { userId, headers: { "User-Id": userId } }),
      sdk.context({ secrets }),
    );

    expect(vi.mocked(getPushId)).toHaveBeenCalledExactlyOnceWith(
      userId,
      secrets.udpNotificationSecret,
    );
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({ pushId });
  });

  it("returns 500 when push ID generation fails", async ({ sdk }) => {
    vi.mocked(getPushId).mockThrow(
      new Error("User ID and secret key cannot be empty"),
    );

    const result = await handler(
      sdk.event.get(endpoint, { userId, headers: { "User-Id": userId } }),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(500);
  });
});
