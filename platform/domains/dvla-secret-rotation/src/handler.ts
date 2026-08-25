import { logger } from "@flex/logging";
import type { SecretsManagerRotationEvent } from "aws-lambda";

import { authenticate, changePassword, requestNewApiKey } from "./dvla-client";
import { generatePassword } from "./generate-password";
import { DvlaSecretSchema } from "./schema";
import {
  describeSecret,
  getSecretValue,
  putSecretValue,
  updateSecretVersionStage,
} from "./secrets-manager-client";

export async function handler(
  event: SecretsManagerRotationEvent,
): Promise<void> {
  const { Step: step, SecretId: secretId, ClientRequestToken: token } = event;

  logger.info("Rotation step invoked", { step, secretId, token });

  const metadata = await describeSecret(secretId);
  const stages = metadata.versionIdsToStages[token];

  if (!stages) {
    throw new Error(
      `Secret version ${token} has no stage for secret ${secretId}`,
    );
  }

  if (stages.includes("AWSCURRENT")) {
    logger.info("Secret version already set as AWSCURRENT, nothing to do");
    return;
  }

  if (!stages.includes("AWSPENDING")) {
    throw new Error(
      `Secret version ${token} not set as AWSPENDING for secret ${secretId}`,
    );
  }

  switch (step) {
    case "createSecret":
      await handleCreateSecret(secretId, token);
      break;
    case "setSecret":
      logger.info(
        "setSecret is a no-op - DVLA credentials are updated instantly",
      );
      break;
    case "testSecret":
      await handleTestSecret(secretId, token);
      break;
    case "finishSecret":
      await handleFinishSecret(secretId, token);
      break;
    default:
      throw new Error(`Unknown rotation step: ${step as string}`);
  }
}

async function handleCreateSecret(
  secretId: string,
  token: string,
): Promise<void> {
  try {
    await getSecretValue(secretId, "AWSPENDING", token);
    logger.info("createSecret: AWSPENDING secret already exists, skipping");
    return;
  } catch {
    // Expected - no pending secret exists yet
  }

  const currentSecretString = await getSecretValue(secretId, "AWSCURRENT");
  const currentSecret = DvlaSecretSchema.parse(JSON.parse(currentSecretString));

  const newPassword = generatePassword(20);

  await changePassword({
    apiUrl: currentSecret.apiUrl,
    userName: currentSecret.apiUsername,
    password: currentSecret.apiPassword,
    newPassword,
  });

  const jwt = await authenticate({
    apiUrl: currentSecret.apiUrl,
    userName: currentSecret.apiUsername,
    password: newPassword,
  });

  const newApiKey = await requestNewApiKey({
    apiUrl: currentSecret.apiUrl,
    currentApiKey: currentSecret.apiKey,
    jwt,
  });

  const newSecret = {
    ...currentSecret,
    apiPassword: newPassword,
    apiKey: newApiKey,
  };

  await putSecretValue(secretId, JSON.stringify(newSecret), token);
  logger.info("createSecret: new credentials stored in AWSPENDING");
}

async function handleTestSecret(
  secretId: string,
  token: string,
): Promise<void> {
  const pendingSecretString = await getSecretValue(
    secretId,
    "AWSPENDING",
    token,
  );
  const pendingSecret = DvlaSecretSchema.parse(JSON.parse(pendingSecretString));

  await authenticate({
    apiUrl: pendingSecret.apiUrl,
    userName: pendingSecret.apiUsername,
    password: pendingSecret.apiPassword,
  });

  logger.info("testSecret: AWSPENDING credentials verified successfully");
}

async function handleFinishSecret(
  secretId: string,
  token: string,
): Promise<void> {
  const metadata = await describeSecret(secretId);

  let currentVersionId: string | undefined;
  for (const [versionId, stages] of Object.entries(
    metadata.versionIdsToStages,
  )) {
    if (stages.includes("AWSCURRENT") && versionId !== token) {
      currentVersionId = versionId;
      break;
    }
  }

  if (!currentVersionId) {
    throw new Error(
      "Could not find current version of secret to finalize rotation",
    );
  }

  await updateSecretVersionStage(secretId, token, currentVersionId);
  logger.info(
    "finishSecret: rotation complete, AWSPENDING promoted to AWSCURRENT",
  );
}
