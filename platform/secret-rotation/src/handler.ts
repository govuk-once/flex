import {
  DescribeSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretVersionStageCommand,
} from "@aws-sdk/client-secrets-manager";
import { randomBytes } from "node:crypto";

const client = new SecretsManagerClient();

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SECRET_LENGTH = 32;

function generateAlphanumericSecret(): string {
  const bytes = randomBytes(SECRET_LENGTH);
  return Array.from(bytes, (b) => ALPHANUMERIC[b % ALPHANUMERIC.length]).join(
    "",
  );
}

interface RotationEvent {
  SecretId: string;
  ClientRequestToken: string;
  Step: "createSecret" | "setSecret" | "testSecret" | "finishSecret";
}

export const handler = async (event: RotationEvent): Promise<void> => {
  const { SecretId: secretId, ClientRequestToken: token, Step: step } = event;

  const metadata = await client.send(
    new DescribeSecretCommand({ SecretId: secretId }),
  );

  if (!metadata.RotationEnabled) {
    throw new Error(`Secret ${secretId} does not have rotation enabled`);
  }

  const versions = metadata.VersionIdsToStages ?? {};
  if (!versions[token]) {
    throw new Error(
      `Secret version ${token} has no stage for secret ${secretId}`,
    );
  }

  if (versions[token]?.includes("AWSCURRENT")) {
    return;
  }

  if (!versions[token]?.includes("AWSPENDING")) {
    throw new Error(
      `Secret version ${token} not set as AWSPENDING for secret ${secretId}`,
    );
  }

  switch (step) {
    case "createSecret":
      await createSecret(secretId, token);
      break;
    case "setSecret":
      break;
    case "testSecret":
      await testSecret(secretId, token);
      break;
    case "finishSecret":
      await finishSecret(secretId, token, versions);
      break;
  }
};

async function createSecret(secretId: string, token: string): Promise<void> {
  try {
    await client.send(
      new GetSecretValueCommand({
        SecretId: secretId,
        VersionId: token,
        VersionStage: "AWSPENDING",
      }),
    );
    return;
  } catch {
    // No pending version exists yet — generate one
  }

  await client.send(
    new PutSecretValueCommand({
      SecretId: secretId,
      ClientRequestToken: token,
      SecretString: generateAlphanumericSecret(),
      VersionStages: ["AWSPENDING"],
    }),
  );
}

async function testSecret(secretId: string, token: string): Promise<void> {
  await client.send(
    new GetSecretValueCommand({
      SecretId: secretId,
      VersionId: token,
      VersionStage: "AWSPENDING",
    }),
  );
}

async function finishSecret(
  secretId: string,
  token: string,
  versions: Record<string, string[]>,
): Promise<void> {
  const currentVersion = Object.entries(versions).find(([, stages]) =>
    stages.includes("AWSCURRENT"),
  )?.[0];

  if (currentVersion === token) {
    return;
  }

  await client.send(
    new UpdateSecretVersionStageCommand({
      SecretId: secretId,
      VersionStage: "AWSCURRENT",
      MoveToVersionId: token,
      RemoveFromVersionId: currentVersion,
    }),
  );
}
