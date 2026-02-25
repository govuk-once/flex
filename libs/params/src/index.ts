import { getLogger } from "@flex/logging";
import type {
  OmitPropsWithSuffix,
  OnlyPropsWithSuffix,
  Simplify,
  WithoutPropSuffix,
  WithoutSuffix,
} from "@flex/utils";
import { z } from "zod";

import { populateFeatureFlags } from "./featureFlags";
import { populateSecrets } from "./secrets";
import { populateParameterFields } from "./ssm";
import { splitBySuffix } from "./utils";

const cachedConfig: Map<z.ZodType, unknown> = new Map();

/**
 * Retrieves the parsed configuration, using a cached version if available. Replaces any parameter name fields with their actual values from SSM.
 *
 * @returns The parsed, populated configuration object.
 */
export async function getConfig<T extends Record<string, string>>(
  validator: z.ZodType<T>,
) {
  const logger = getLogger();

  if (cachedConfig.has(validator)) {
    logger.info("Returning cached configuration");

    // This is safe because we only set values of this type in the cache.
    return cachedConfig.get(validator) as {
      parameters: Simplify<
        WithoutPropSuffix<OnlyPropsWithSuffix<T, "_PARAM_NAME">, "_PARAM_NAME">
      >;
      featureFlags: Simplify<
        WithoutSuffix<OnlyPropsWithSuffix<T, "_FEATURE_FLAG">, "_FEATURE_FLAG">
      >;
      secrets: Simplify<
        WithoutSuffix<OnlyPropsWithSuffix<T, "_SECRET">, "_SECRET">
      >;
      envvars: Simplify<
        OmitPropsWithSuffix<T, "_PARAM_NAME" | "_FEATURE_FLAG" | "_SECRET">
      >;
    };
  }

  logger.info(
    "cachedConfig not found, building configuration from process.env and SSM",
  );
  const rawConfigSchemaCheck = validator.safeParse(process.env);

  if (!rawConfigSchemaCheck.success) {
    const message = `Invalid raw configuration: ${JSON.stringify(z.treeifyError(rawConfigSchemaCheck.error))}`;
    logger.error(message);
    throw new Error(message);
  }

  const rawConfig = rawConfigSchemaCheck.data;

  const [parametersOnly, nonParameterConfig] = splitBySuffix(
    rawConfig,
    "_PARAM_NAME",
  );

  const [featureFlagsOnly, nonFeatureFlagConfig] = splitBySuffix(
    nonParameterConfig,
    "_FEATURE_FLAG",
  );

  const [secretsOnly, envvars] = splitBySuffix(nonFeatureFlagConfig, "_SECRET");

  const populatedParameters = await populateParameterFields(parametersOnly);
  const populatedFeatureFlags = populateFeatureFlags(featureFlagsOnly);
  const populatedSecrets = await populateSecrets(secretsOnly);

  const finalConfig = {
    parameters: populatedParameters,
    featureFlags: populatedFeatureFlags,
    secrets: populatedSecrets,
    envvars,
  };

  cachedConfig.set(validator, finalConfig);

  return finalConfig;
}
