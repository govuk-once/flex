import {
  ListSecretsCommand,
  ListSecretVersionIdsCommand,
  type SecretListEntry,
  SecretsManagerClient,
  type SecretVersionsListEntry,
} from "@aws-sdk/client-secrets-manager";

import { collectPages } from "../paginate";

const client = new SecretsManagerClient({});

export function listSecrets(): Promise<SecretListEntry[]> {
  return collectPages(async (nextToken) => {
    const response = await client.send(
      new ListSecretsCommand({ NextToken: nextToken }),
    );

    return { items: response.SecretList ?? [], nextToken: response.NextToken };
  });
}

export function listSecretVersions(
  secretId: string,
): Promise<SecretVersionsListEntry[]> {
  return collectPages(async (nextToken) => {
    const response = await client.send(
      new ListSecretVersionIdsCommand({
        SecretId: secretId,
        NextToken: nextToken,
      }),
    );

    return { items: response.Versions ?? [], nextToken: response.NextToken };
  });
}
