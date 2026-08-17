import { createUserId, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { getPushId } from "./get-push-id";

describe("getPushId", () => {
  const testUserId = createUserId();
  const key = "test-secret-key-32-chars-minimum";

  it("returns the same ID for identical inputs", () => {
    expect(getPushId(testUserId, key)).toBe(getPushId(testUserId, key));
  });

  it("returns unique IDs for different user IDs", () => {
    expect(getPushId(createUserId("user-1"), key)).not.toBe(
      getPushId(createUserId("user-2"), key),
    );
  });

  it("returns unique IDs for different secrets", () => {
    expect(getPushId(testUserId, "secret-key-1-32-chars-minimum")).not.toBe(
      getPushId(testUserId, "secret-key-2-32-chars-minimum"),
    );
  });

  it("returns base64url encoded output", () => {
    const pushId = getPushId(testUserId, key);

    // Base64URL should not contain +, /, or = characters
    expect(pushId).not.toContain("+");
    expect(pushId).not.toContain("/");
    expect(pushId).not.toContain("=");
  });

  it("returns IDs of consistent length", () => {
    // HMAC-SHA256 produces 32 bytes, base64url encoded is 43 characters
    expect(getPushId(createUserId("short"), key)).toHaveLength(43);
    expect(
      getPushId(createUserId("very-long-user-id-with-many-characters"), key),
    ).toHaveLength(43);
  });

  describe("errors", () => {
    it("throws when user ID is empty", () => {
      expect(() => getPushId(createUserId(""), key)).toThrow(
        "User ID and secret key cannot be empty",
      );
    });

    it("throws when secret key is empty", () => {
      expect(() => getPushId(testUserId, "")).toThrow(
        "User ID and secret key cannot be empty",
      );
    });
  });
});
