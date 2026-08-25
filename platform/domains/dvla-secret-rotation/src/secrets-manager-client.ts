import {
  DescribeSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretVersionStageCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({});

export async function getSecretValue(
  secretId: string,
  stage: "AWSCURRENT" | "AWSPENDING",
  versionId?: string,
): Promise<string> {
  const command = new GetSecretValueCommand({
    SecretId: secretId,
    VersionStage: stage,
    ...(versionId && { VersionId: versionId }),
  });

  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} has no SecretString at stage ${stage}`);
  }

  return response.SecretString;
}

export async function putSecretValue(
  secretId: string,
  secretString: string,
  clientRequestToken: string,
): Promise<void> {
  const command = new PutSecretValueCommand({
    SecretId: secretId,
    SecretString: secretString,
    ClientRequestToken: clientRequestToken,
    VersionStages: ["AWSPENDING"],
  });

  await client.send(command);
}

export async function describeSecret(secretId: string): Promise<{
  versionIdsToStages: Record<string, string[]>;
}> {
  const command = new DescribeSecretCommand({ SecretId: secretId });
  const response = await client.send(command);

  return { versionIdsToStages: response.VersionIdsToStages ?? {} };
}

export async function updateSecretVersionStage(
  secretId: string,
  versionId: string,
  removeFromVersionId: string,
): Promise<void> {
  const command = new UpdateSecretVersionStageCommand({
    SecretId: secretId,
    VersionStage: "AWSCURRENT",
    MoveToVersionId: versionId,
    RemoveFromVersionId: removeFromVersionId,
  });

  await client.send(command);
}
