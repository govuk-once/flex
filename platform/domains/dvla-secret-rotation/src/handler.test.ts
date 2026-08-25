import { it } from "@flex/testing";
import type { SecretsManagerRotationEvent } from "aws-lambda";
import { describe, expect, vi } from "vitest";

import { handler } from "./handler";

vi.mock("@flex/logging");
vi.mock("./dvla-client");
vi.mock("./generate-password");
vi.mock("./secrets-manager-client");

import { authenticate, changePassword, requestNewApiKey } from "./dvla-client";
import { generatePassword } from "./generate-password";
import {
  describeSecret,
  getSecretValue,
  putSecretValue,
  updateSecretVersionStage,
} from "./secrets-manager-client";

const secretId =
  "arn:aws:secretsmanager:eu-west-2:123456789:secret:dvla-config";
const token = "test-client-request-token";

const currentSecret = JSON.stringify({
  apiUrl: "https://dvla.example.com",
  apiKey: "current-api-key", // pragma: allowlist secret
  apiUsername: "testuser",
  apiPassword: "current-password", // pragma: allowlist secret
  wellKnownJwkUrl: "https://dvla.example.com/.well-known/jwks.json",
});

function createEvent(step: string): SecretsManagerRotationEvent {
  return {
    Step: step as SecretsManagerRotationEvent["Step"],
    SecretId: secretId,
    ClientRequestToken: token,
  };
}

describe("handler", () => {
  it.beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(describeSecret).mockResolvedValue({
      versionIdsToStages: {
        [token]: ["AWSPENDING"],
        "old-version-id": ["AWSCURRENT"],
      },
    });
  });

  it("short-circuits when the version is already AWSCURRENT", async () => {
    vi.mocked(describeSecret).mockResolvedValue({
      versionIdsToStages: {
        [token]: ["AWSCURRENT"],
      },
    });

    await handler(createEvent("createSecret"));

    expect(getSecretValue).not.toHaveBeenCalled();
  });

  it("throws when the token has no stage", async () => {
    vi.mocked(describeSecret).mockResolvedValue({
      versionIdsToStages: {},
    });

    await expect(handler(createEvent("createSecret"))).rejects.toThrow(
      `Secret version ${token} has no stage for secret ${secretId}`,
    );
  });

  it("throws when the token is not in AWSPENDING", async () => {
    vi.mocked(describeSecret).mockResolvedValue({
      versionIdsToStages: {
        [token]: ["AWSPREVIOUS"],
      },
    });

    await expect(handler(createEvent("createSecret"))).rejects.toThrow(
      `Secret version ${token} not set as AWSPENDING for secret ${secretId}`,
    );
  });

  it("throws on an unknown step", async () => {
    await expect(handler(createEvent("unknownStep"))).rejects.toThrow(
      "Unknown rotation step: unknownStep",
    );
  });

  describe("createSecret", () => {
    it("skips if AWSPENDING already exists for this token", async () => {
      vi.mocked(getSecretValue).mockResolvedValueOnce(currentSecret);

      await handler(createEvent("createSecret"));

      expect(changePassword).not.toHaveBeenCalled();
    });

    it("rotates password and API key then stores in AWSPENDING", async () => {
      vi.mocked(getSecretValue)
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce(currentSecret);

      vi.mocked(generatePassword).mockReturnValue("new-random-password1");
      vi.mocked(authenticate).mockResolvedValue("new-jwt-token");
      vi.mocked(requestNewApiKey).mockResolvedValue("new-api-key-value");

      await handler(createEvent("createSecret"));

      expect(changePassword).toHaveBeenCalledWith({
        apiUrl: "https://dvla.example.com",
        userName: "testuser",
        password: "current-password", // pragma: allowlist secret
        newPassword: "new-random-password1", // pragma: allowlist secret
      });

      expect(authenticate).toHaveBeenCalledWith({
        apiUrl: "https://dvla.example.com",
        userName: "testuser",
        password: "new-random-password1", // pragma: allowlist secret
      });

      expect(requestNewApiKey).toHaveBeenCalledWith({
        apiUrl: "https://dvla.example.com",
        currentApiKey: "current-api-key", // pragma: allowlist secret
        jwt: "new-jwt-token",
      });

      expect(putSecretValue).toHaveBeenCalledWith(
        secretId,
        JSON.stringify({
          apiUrl: "https://dvla.example.com",
          apiKey: "new-api-key-value", // pragma: allowlist secret
          apiUsername: "testuser",
          apiPassword: "new-random-password1", // pragma: allowlist secret
          wellKnownJwkUrl: "https://dvla.example.com/.well-known/jwks.json",
        }),
        token,
      );
    });

    it("throws when DVLA password change fails", async () => {
      vi.mocked(getSecretValue)
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce(currentSecret);

      vi.mocked(generatePassword).mockReturnValue("new-random-password1");
      vi.mocked(changePassword).mockRejectedValue(
        new Error("DVLA password change failed: 500"),
      );

      await expect(handler(createEvent("createSecret"))).rejects.toThrow(
        "DVLA password change failed: 500",
      );
    });
  });

  describe("setSecret", () => {
    it("is a no-op", async () => {
      await handler(createEvent("setSecret"));

      expect(getSecretValue).not.toHaveBeenCalled();
      expect(putSecretValue).not.toHaveBeenCalled();
    });
  });

  describe("testSecret", () => {
    it("authenticates with pending credentials", async () => {
      const pendingSecret = JSON.stringify({
        apiUrl: "https://dvla.example.com",
        apiKey: "new-api-key", // pragma: allowlist secret
        apiUsername: "testuser",
        apiPassword: "new-password", // pragma: allowlist secret
        wellKnownJwkUrl: "https://dvla.example.com/.well-known/jwks.json",
      });

      vi.mocked(getSecretValue).mockResolvedValue(pendingSecret);
      vi.mocked(authenticate).mockResolvedValue("jwt-token");

      await handler(createEvent("testSecret"));

      expect(getSecretValue).toHaveBeenCalledWith(
        secretId,
        "AWSPENDING",
        token,
      );

      expect(authenticate).toHaveBeenCalledWith({
        apiUrl: "https://dvla.example.com",
        userName: "testuser",
        password: "new-password", // pragma: allowlist secret
      });
    });

    it("throws when authentication with pending credentials fails", async () => {
      vi.mocked(getSecretValue).mockResolvedValue(currentSecret);
      vi.mocked(authenticate).mockRejectedValue(
        new Error("DVLA authentication failed: 401"),
      );

      await expect(handler(createEvent("testSecret"))).rejects.toThrow(
        "DVLA authentication failed: 401",
      );
    });
  });

  describe("finishSecret", () => {
    it("moves AWSPENDING to AWSCURRENT", async () => {
      await handler(createEvent("finishSecret"));

      expect(updateSecretVersionStage).toHaveBeenCalledWith(
        secretId,
        token,
        "old-version-id",
      );
    });

    it("throws when no current version is found", async () => {
      vi.mocked(describeSecret).mockResolvedValue({
        versionIdsToStages: {
          [token]: ["AWSPENDING"],
        },
      });

      await expect(handler(createEvent("finishSecret"))).rejects.toThrow(
        "Could not find current version of secret to finalize rotation",
      );
    });
  });
});
