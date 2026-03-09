import { it } from "@flex/testing";
import { createUserId } from "@flex/testing";
import { describe, expect } from "vitest";

import { getNotificationId } from "./getNotificationId";

describe("getNotificationId", () => {
  const secretKey = "test-secret-key-32-chars-minimum"; // pragma: allowlist secret

  it("generates a deterministic ID for a given user ID and secret key", ({
    userId,
  }) => {
    const id1 = getNotificationId({ userId, secretKey });
    const id2 = getNotificationId({ userId, secretKey });

    expect(id1).toBe(id2);
  });

  it("generates different IDs for different user IDs", () => {
    const id1 = getNotificationId({
      userId: createUserId("user-1"),
      secretKey,
    });
    const id2 = getNotificationId({
      userId: createUserId("user-2"),
      secretKey,
    });

    expect(id1).not.toBe(id2);
  });

  it("generates different IDs for different secret keys", ({ userId }) => {
    const id1 = getNotificationId({
      userId,
      secretKey: "secret-key-1-32-chars-minimum", // pragma: allowlist secret
    });
    const id2 = getNotificationId({
      userId,
      secretKey: "secret-key-2-32-chars-minimum", // pragma: allowlist secret
    });

    expect(id1).not.toBe(id2);
  });

  it("generates base64url encoded output (URL-safe)", ({ userId }) => {
    const id = getNotificationId({ userId, secretKey });

    // Base64URL should not contain +, /, or = characters
    expect(id).not.toContain("+");
    expect(id).not.toContain("/");
    expect(id).not.toContain("=");
  });

  it("generates IDs of consistent length", () => {
    const id1 = getNotificationId({
      userId: createUserId("short"),
      secretKey,
    });
    const id2 = getNotificationId({
      userId: createUserId("very-long-user-id-with-many-characters"),
      secretKey,
    });

    // HMAC-SHA256 produces 32 bytes, base64url encoded is 43 characters
    expect(id1.length).toBe(43);
    expect(id2.length).toBe(43);
  });

  it("throws an error if the user ID is empty", () => {
    expect(() =>
      getNotificationId({ userId: createUserId(""), secretKey }),
    ).toThrow("User ID and secret key cannot be empty");
  });

  it("throws an error if the secret key is empty", ({ userId }) => {
    expect(() => getNotificationId({ userId, secretKey: "" })).toThrow(
      "User ID and secret key cannot be empty",
    );
  });
});
