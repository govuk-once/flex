import {
  ListSecretsCommand,
  ListSecretVersionIdsCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { mockClient } from "aws-sdk-client-mock";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { listSecrets, listSecretVersions } from "./secrets-manager";

const secretsManager = mockClient(SecretsManagerClient);

describe("secrets manager client", () => {
  beforeEach(() => {
    secretsManager.reset();
  });

  afterAll(() => {
    secretsManager.restore();
  });

  describe("listSecrets", () => {
    it("collects secrets across every page", async () => {
      secretsManager
        .on(ListSecretsCommand, { NextToken: undefined })
        .resolves({ SecretList: [{ Name: "a" }], NextToken: "page-2" })
        .on(ListSecretsCommand, { NextToken: "page-2" })
        .resolves({ SecretList: [{ Name: "b" }] });

      await expect(listSecrets()).resolves.toEqual([
        { Name: "a" },
        { Name: "b" },
      ]);
      expect(secretsManager.commandCalls(ListSecretsCommand)).toHaveLength(2);
    });

    it("returns an empty list when the response has no secret list", async () => {
      secretsManager.on(ListSecretsCommand).resolves({});

      await expect(listSecrets()).resolves.toEqual([]);
    });
  });

  describe("listSecretVersions", () => {
    it("collects versions of the secret across every page", async () => {
      secretsManager
        .on(ListSecretVersionIdsCommand, {
          SecretId: "udp",
          NextToken: undefined,
        })
        .resolves({ Versions: [{ VersionId: "1" }], NextToken: "page-2" })
        .on(ListSecretVersionIdsCommand, {
          SecretId: "udp",
          NextToken: "page-2",
        })
        .resolves({ Versions: [{ VersionId: "2" }] });

      await expect(listSecretVersions("udp")).resolves.toEqual([
        { VersionId: "1" },
        { VersionId: "2" },
      ]);
    });

    it("returns an empty list when the response has no versions", async () => {
      secretsManager.on(ListSecretVersionIdsCommand).resolves({});

      await expect(listSecretVersions("udp")).resolves.toEqual([]);
    });

    it("propagates a failure", async () => {
      secretsManager
        .on(ListSecretVersionIdsCommand)
        .rejects(new Error("ResourceNotFoundException"));

      await expect(listSecretVersions("missing")).rejects.toThrow(
        "ResourceNotFoundException",
      );
    });
  });
});
