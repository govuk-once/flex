import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetClientMocks, restoreClientMocks } from "../utils/awsMock";
import { createSecretFixture } from "./secret";

const secret = createSecretFixture();

const client = new SecretsManagerClient({ region: "eu-west-2" });

const getSecret = (SecretId: string) =>
  client.send(new GetSecretValueCommand({ SecretId }));

describe("createSecretFixture", () => {
  beforeEach(() => {
    vi.stubEnv("AWS_REGION", "eu-west-2");
    resetClientMocks();
  });

  afterEach(() => {
    restoreClientMocks();
    vi.unstubAllEnvs();
  });

  it("builds the ARN a secret of that name has", () => {
    expect(secret.arn("example-consumer")).toBe(
      "arn:aws:secretsmanager:eu-west-2:123456789012:secret:example-consumer",
    );
  });

  it("serialises the value and returns the ARN it stubbed", async () => {
    const arn = secret.resolves("example-consumer", { apiUrl: "https://api" });

    expect(arn).toBe(secret.arn("example-consumer"));

    const result = await getSecret(arn);

    expect(result.ARN).toBe(arn);
    expect(result.Name).toBe("example-consumer");
    expect(result.SecretString).toBe(JSON.stringify({ apiUrl: "https://api" }));
  });

  it("passes a string value through untouched", async () => {
    const arn = secret.resolves("example-token", "plain-value");

    expect((await getSecret(arn)).SecretString).toBe("plain-value");
  });

  it("only answers for the secret it stubbed", async () => {
    secret.resolves("example-consumer", {});

    expect(await getSecret(secret.arn("other-secret"))).toBeUndefined();
  });

  it("rejects with the given error", async () => {
    const arn = secret.rejects(
      "example-consumer",
      new Error("ResourceNotFoundException"),
    );

    await expect(getSecret(arn)).rejects.toThrow("ResourceNotFoundException");
  });

  it("records every secret read", async () => {
    const arn = secret.resolves("example-consumer", {});

    await getSecret(arn);

    expect(secret.calls()).toStrictEqual([{ SecretId: arn }]);
  });
});
