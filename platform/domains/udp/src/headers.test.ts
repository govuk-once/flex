import { afterEach, describe, expect, it, vi } from "vitest";

import { requestingUserHeaders, withRequestedAt } from "./headers";

const apiKey = "test-api-key"; // pragma: allowlist secret
const userId = "test-user-id";

describe("requestingUserHeaders", () => {
  it("returns the api key, requesting service and requesting user", () => {
    expect(requestingUserHeaders(apiKey, userId)).toStrictEqual({
      "x-api-key": apiKey,
      "requesting-service": "app",
      "requesting-service-user-id": userId,
    });
  });
});

describe("withRequestedAt", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the given headers and adds requested-at from the supplied time", () => {
    const now = new Date("2026-09-14T12:00:00.000Z");

    expect(withRequestedAt({ "x-api-key": apiKey }, now)).toStrictEqual({
      "x-api-key": apiKey,
      "requested-at": "2026-09-14T12:00:00.000Z",
    });
  });

  it("uses the current time on every call when no time is supplied", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z"));

    const first = withRequestedAt({ "x-api-key": apiKey });
    vi.advanceTimersByTime(1000);
    const second = withRequestedAt({ "x-api-key": apiKey });

    expect(first["requested-at"]).toBe("2026-09-14T12:00:00.000Z");
    expect(second["requested-at"]).toBe("2026-09-14T12:00:01.000Z");
  });
});
