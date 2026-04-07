import { it } from "@flex/testing";
import { createUserId } from "@flex/testing";
import { describe, expect } from "vitest";

import { getPushId } from "./get-push-id";

describe("getPushId", () => {
  const key = "test-secret-key-32-chars-minimum";

  it("returns the same ID for identical inputs", ({ userId }) => {
    expect(getPushId(userId, key)).toBe(getPushId(userId, key));
  });

  it("returns unique IDs for different user IDs", () => {
    expect(getPushId(createUserId("user-1"), key)).not.toBe(
      getPushId(createUserId("user-2"), key),
    );
  });

  it("returns unique IDs for different secrets", ({ userId }) => {
    expect(getPushId(userId, "secret-key-1-32-chars-minimum")).not.toBe(
      getPushId(userId, "secret-key-2-32-chars-minimum"),
    );
  });

  it("returns base64url encoded output", ({ userId }) => {
    const pushId = getPushId(userId, key);

    // Base64URL should not contain +, /, or = characters
    expect(pushId).not.toContain("+");
    expect(pushId).not.toContain("/");
    expect(pushId).not.toContain("=");
  });

  it("returns IDs of consistent length", () => {
    // HMAC-SHA256 produces 32 bytes, base64url encoded is 43 characters
    expect(getPushId(createUserId("short"), key).length).toBe(43);
    expect(
      getPushId(createUserId("very-long-user-id-with-many-characters"), key)
        .length,
    ).toBe(43);
  });

  describe("errors", () => {
    it("throws when user ID is empty", () => {
      expect(() => getPushId(createUserId(""), key)).toThrow(
        "User ID and secret key cannot be empty",
      );
    });

    it("throws when secret key is empty", ({ userId }) => {
      expect(() => getPushId(userId, "")).toThrow(
        "User ID and secret key cannot be empty",
      );
    });
  });
});
