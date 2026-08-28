import { randomUUID } from "node:crypto";

import { logger } from "@flex/logging";
import type { SecretsManagerRotationEvent } from "aws-lambda";

import { authenticate, changePassword, requestNewApiKey } from "./dvla-client";
import { generatePassword } from "./generate-password";
import { type DvlaSecret, DvlaSecretSchema } from "./schema";
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
  const CHECKPOINT_STAGE = "AWSPENDING_CHECKPOINT";

  const currentSecretString = await getSecretValue(secretId, "AWSCURRENT");
  const currentSecret = DvlaSecretSchema.parse(JSON.parse(currentSecretString));

  // Check if the final AWSPENDING version (tagged with the rotation token) already exists
  try {
    const finalPendingString = await getSecretValue(
      secretId,
      "AWSPENDING",
      token,
    );
    const finalPending = DvlaSecretSchema.parse(JSON.parse(finalPendingString));

    if (finalPending.apiKey !== currentSecret.apiKey) {
      logger.info(
        "createSecret: AWSPENDING secret already fully rotated, skipping",
      );
      return;
    }
  } catch {
    // No final version yet
  }

  // Check for a checkpoint version (password rotated, API key not yet)
  let checkpointSecret: typeof currentSecret | undefined;
  try {
    const checkpointString = await getSecretValue(secretId, CHECKPOINT_STAGE);
    checkpointSecret = DvlaSecretSchema.parse(JSON.parse(checkpointString));
  } catch {
    // No checkpoint exists
  }

  const resumePassword =
    checkpointSecret &&
    checkpointSecret.apiKey === currentSecret.apiKey &&
    checkpointSecret.apiPassword !== currentSecret.apiPassword
      ? checkpointSecret.apiPassword
      : undefined;

  const password = resumePassword ?? (await rotatePassword(currentSecret));

  if (!resumePassword) {
    // Persist the new password under a separate staging label and its own version ID
    // so the token's AWSPENDING version is not touched
    await putSecretValue(
      secretId,
      JSON.stringify({ ...currentSecret, apiPassword: password }),
      randomUUID(),
      [CHECKPOINT_STAGE],
    );
    logger.info("createSecret: new password checkpointed");
  }

  const jwt = await authenticate({
    apiUrl: currentSecret.apiUrl,
    userName: currentSecret.apiUsername,
    password,
  });

  const newApiKey = await requestNewApiKey({
    apiUrl: currentSecret.apiUrl,
    currentApiKey: currentSecret.apiKey,
    jwt,
  });

  await putSecretValue(
    secretId,
    JSON.stringify({
      ...currentSecret,
      apiPassword: password,
      apiKey: newApiKey,
    }),
    token,
  );
  logger.info("createSecret: new password and API key stored in AWSPENDING");
}

async function rotatePassword(currentSecret: DvlaSecret): Promise<string> {
  const newPassword = generatePassword(20);

  await changePassword({
    apiUrl: currentSecret.apiUrl,
    userName: currentSecret.apiUsername,
    password: currentSecret.apiPassword,
    newPassword,
  });

  return newPassword;
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
