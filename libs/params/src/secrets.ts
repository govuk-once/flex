import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getLogger } from "@flex/logging";
import { Simplify, WithoutPropSuffix } from "@flex/utils";

import { removeSuffixFromFields } from "./utils";

export async function populateSecrets<T extends object>(
  secretsConfig: T,
): Promise<Simplify<WithoutPropSuffix<T, "_SECRET">>> {
  const logger = getLogger();
  const secretEntries = Object.entries(secretsConfig);

  try {
    const populatedSecretEntries = await Promise.all(
      secretEntries.map(async ([key, value]) => {
        const secretValue = await getSecret(value as string);
        return [key, secretValue] as [string, string];
      }),
    );

    return removeSuffixFromFields(
      Object.fromEntries(populatedSecretEntries),
      "_SECRET",
    ) as Simplify<WithoutPropSuffix<T, "_SECRET">>;
  } catch (error) {
    const message = `Error fetching secrets: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(message);
    throw new Error(message);
  }
}
