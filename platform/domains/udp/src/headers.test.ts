import { afterEach, describe, expect, it, vi } from "vitest";

import { requestingUserHeaders, requestingUserWriteHeaders } from "./headers";

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

describe("requestingUserWriteHeaders", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds requested-at from the supplied time", () => {
    const now = new Date("2026-09-14T12:00:00.000Z");

    expect(requestingUserWriteHeaders(apiKey, userId, now)).toStrictEqual({
      ...requestingUserHeaders(apiKey, userId),
      "requested-at": "2026-09-14T12:00:00.000Z",
    });
  });

  it("uses the current time on every call when no time is supplied", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T12:00:00.000Z"));

    const first = requestingUserWriteHeaders(apiKey, userId);
    vi.advanceTimersByTime(1000);
    const second = requestingUserWriteHeaders(apiKey, userId);

    expect(first["requested-at"]).toBe("2026-09-14T12:00:00.000Z");
    expect(second["requested-at"]).toBe("2026-09-14T12:00:01.000Z");
  });
});
