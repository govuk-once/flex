import { it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { authenticate, changePassword, requestNewApiKey } from "./dvla-client";

vi.mock("@flex/logging");

const apiUrl = "https://dvla.example.com";

describe("dvla-client", () => {
  describe("changePassword", () => {
    it("sends a POST request to the password endpoint", async ({ http }) => {
      http.url(apiUrl).post("/thirdparty-access/v1/password").reply(200, {});

      await expect(
        changePassword({
          apiUrl,
          userName: "testuser",
          password: "oldpass", // pragma: allowlist secret
          newPassword: "newpass123", // pragma: allowlist secret
        }),
      ).resolves.toBeUndefined();
    });

    it("throws when the API returns an error", async ({ http }) => {
      http
        .url(apiUrl)
        .post("/thirdparty-access/v1/password")
        .reply(401, { message: "Unauthorized" });

      await expect(
        changePassword({
          apiUrl,
          userName: "testuser",
          password: "wrongpass", // pragma: allowlist secret
          newPassword: "newpass123", // pragma: allowlist secret
        }),
      ).rejects.toThrow("DVLA password change failed: 401");
    });
  });

  describe("authenticate", () => {
    it("returns a JWT on successful authentication", async ({ http }) => {
      http
        .url(apiUrl)
        .post("/thirdparty-access/v1/authenticate")
        .reply(200, { "id-token": "jwt-token-123" });

      const jwt = await authenticate({
        apiUrl,
        userName: "testuser",
        password: "password123", // pragma: allowlist secret
      });

      expect(jwt).toBe("jwt-token-123");
    });

    it("throws when the API returns an error", async ({ http }) => {
      http
        .url(apiUrl)
        .post("/thirdparty-access/v1/authenticate")
        .reply(403, { message: "Forbidden" });

      await expect(
        authenticate({
          apiUrl,
          userName: "testuser",
          password: "wrongpass", // pragma: allowlist secret
        }),
      ).rejects.toThrow("DVLA authentication failed: 403");
    });

    it("throws when the response is missing id-token", async ({ http }) => {
      http
        .url(apiUrl)
        .post("/thirdparty-access/v1/authenticate")
        .reply(200, {});

      await expect(
        authenticate({
          apiUrl,
          userName: "testuser",
          password: "password123", // pragma: allowlist secret
        }),
      ).rejects.toThrow("DVLA authentication response missing id-token");
    });
  });

  describe("requestNewApiKey", () => {
    it("returns a new API key on success", async ({ http }) => {
      http.url(apiUrl).post("/thirdparty-access/v1/new-api-key").reply(200, {
        newApiKey: "new-api-key-456", // pragma: allowlist secret
      });

      const newKey = await requestNewApiKey({
        apiUrl,
        currentApiKey: "old-api-key-123", // pragma: allowlist secret
        jwt: "jwt-token",
      });

      expect(newKey).toBe("new-api-key-456");
    });

    it("throws when the API returns an error", async ({ http }) => {
      http
        .url(apiUrl)
        .post("/thirdparty-access/v1/new-api-key")
        .reply(500, { message: "Internal Server Error" });

      await expect(
        requestNewApiKey({
          apiUrl,
          currentApiKey: "old-api-key-123", // pragma: allowlist secret
          jwt: "jwt-token",
        }),
      ).rejects.toThrow("DVLA new API key request failed: 500");
    });

    it("throws when the response is missing apiKey", async ({ http }) => {
      http.url(apiUrl).post("/thirdparty-access/v1/new-api-key").reply(200, {});

      await expect(
        requestNewApiKey({
          apiUrl,
          currentApiKey: "old-api-key-123", // pragma: allowlist secret
          jwt: "jwt-token",
        }),
      ).rejects.toThrow("DVLA new-api-key response missing newApiKey");
    });
  });
});
