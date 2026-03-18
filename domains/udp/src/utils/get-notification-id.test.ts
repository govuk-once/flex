import { it } from "@flex/testing";
import { createUserId } from "@flex/testing";
import { describe, expect } from "vitest";

import { getNotificationId } from "./get-notification-id";

describe("getNotificationId", () => {
  const key = "test-secret-key-32-chars-minimum";

  it("returns the same ID for identical inputs", ({ userId }) => {
    expect(getNotificationId(userId, key)).toBe(getNotificationId(userId, key));
  });

  it("returns unique IDs for different user IDs", () => {
    expect(getNotificationId(createUserId("user-1"), key)).not.toBe(
      getNotificationId(createUserId("user-2"), key),
    );
  });

  it("returns unique IDs for different secrets", ({ userId }) => {
    expect(getNotificationId(userId, "secret-key-1-32-chars-minimum")).not.toBe(
      getNotificationId(userId, "secret-key-2-32-chars-minimum"),
    );
  });

  it("returns base64url encoded output", ({ userId }) => {
    const notificationId = getNotificationId(userId, key);

    // Base64URL should not contain +, /, or = characters
    expect(notificationId).not.toContain("+");
    expect(notificationId).not.toContain("/");
    expect(notificationId).not.toContain("=");
  });

  it("returns IDs of consistent length", () => {
    // HMAC-SHA256 produces 32 bytes, base64url encoded is 43 characters
    expect(getNotificationId(createUserId("short"), key).length).toBe(43);
    expect(
      getNotificationId(
        createUserId("very-long-user-id-with-many-characters"),
        key,
      ).length,
    ).toBe(43);
  });

  describe("errors", () => {
    it("throws when user ID is empty", () => {
      expect(() => getNotificationId(createUserId(""), key)).toThrow(
        "User ID and secret key cannot be empty",
      );
    });

    it("throws when secret key is empty", ({ userId }) => {
      expect(() => getNotificationId(userId, "")).toThrow(
        "User ID and secret key cannot be empty",
      );
    });
  });
});
