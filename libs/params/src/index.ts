import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { getLogger } from "@flex/logging";
import type {
  FoldSuffixInto,
  OmitPropsWithSuffix,
  OnlyPropsWithSuffix,
  Simplify,
  WithoutPropSuffix,
  WithoutSuffix,
} from "@flex/utils";
import { z } from "zod";

/**
 * Populates parameter fields suffixed with _PARAM_NAME in the raw configuration by fetching their actual values from SSM.
 * Renames the fields to remove the _PARAM_NAME suffix in the returned parsed configuration.
 *
 * @param rawConfig The raw configuration object containing parameter names.
 * @returns The parsed configuration object with parameter values populated.
 */
async function populateParameterFields<T extends object>(
  rawConfig: T,
): Promise<Simplify<WithoutPropSuffix<T, "_PARAM_NAME">>> {
  const logger = getLogger();

  const [parameterNames, nonParameterNames] = Object.entries(rawConfig).reduce<
    [Array<[string, string]>, Array<[string, string]>]
  >(
    (acc, entry) => {
      if (entry[0].endsWith("PARAM_NAME")) {
        acc[0].push(entry as [string, string]);
      } else {
        acc[1].push(entry as [string, string]);
      }
      return acc;
    },
    [[], []],
  );

  const parameterStoreKeys = parameterNames.map(([_, value]) => value);
  logger.debug("Fetching SSM parameters", {
    parameterNames: parameterStoreKeys,
  });

  const populatedParameters = await getParametersByName(
    Object.fromEntries(parameterStoreKeys.map((value) => [value, {}])),
    { decrypt: true },
  );

  const populatedConfigEntries = parameterNames.map(([key, parameterName]) => {
    const parameterValue = populatedParameters[parameterName];

    if (typeof parameterValue !== "string") {
      const message = `Parameter ${parameterName} not found or is not a string`;
      logger.error(message);
      throw new Error(message);
    }

    return [key.replace(/_PARAM_NAME$/, ""), parameterValue] as [
      string,
      string,
    ];
  });

  const parsedConfig = Object.fromEntries([
    ...populatedConfigEntries,
    ...nonParameterNames,
  ]) as Simplify<WithoutPropSuffix<T, "_PARAM_NAME">>;

  return parsedConfig;
}

/**
 * Removes feature flag fields from the raw configuration.
 *
 * @param rawConfig The raw configuration object containing feature flags.
 * @returns The configuration object without feature flag fields.
 */
function removeFeatureFlags<T extends object>(
  rawConfig: T,
): OmitPropsWithSuffix<T, "_FEATURE_FLAG"> {
  const nonFeatureFlagEntries = Object.entries(rawConfig).filter(
    ([key]) => !key.endsWith("_FEATURE_FLAG"),
  ) as Array<[string, string]>;

  return Object.fromEntries(nonFeatureFlagEntries) as OmitPropsWithSuffix<
    T,
    "_FEATURE_FLAG"
  >;
}

/**
 * Extracts feature flag fields from the raw configuration, renames them by removing the _FEATURE_FLAG suffix, and returns them in a new object.
 *
 * @param rawConfig The raw configuration object containing feature flags.
 * @returns The extracted feature flags.
 */
function extractFeatureFlags<T extends object>(
  rawConfig: T,
): Simplify<
  WithoutSuffix<OnlyPropsWithSuffix<T, "_FEATURE_FLAG">, "_FEATURE_FLAG">
> {
  const featureFlagEntries = Object.entries(rawConfig).filter(([key]) =>
    key.endsWith("_FEATURE_FLAG"),
  ) as Array<[string, string]>;

  const renamedFeatureFlagEntries = featureFlagEntries.map(([key, value]) => [
    key.replace(/_FEATURE_FLAG$/, ""),

    // note that this condition catches null and undefined just to be on the safe side.
    // In practice, set environment variables can only be strings. null and undefined values
    // seem to be converted to the strings "null" and "undefined" respectively.
    Boolean(value) &&
      value !== "false" &&
      value !== "0" &&
      value !== "null" &&
      value !== "undefined",
  ]);

  return Object.fromEntries(renamedFeatureFlagEntries) as Simplify<
    WithoutSuffix<OnlyPropsWithSuffix<T, "_FEATURE_FLAG">, "_FEATURE_FLAG">
  >;
}

const cachedConfig: Map<z.ZodType, unknown> = new Map();

/**
 * Retrieves the parsed configuration, using a cached version if available. Replaces any parameter name fields with their actual values from SSM.
 *
 * @returns The parsed, populated configuration object.
 */
export async function getConfig<T extends object>(
  validator: z.ZodType<T>,
): Promise<
  FoldSuffixInto<
    WithoutPropSuffix<T, "_PARAM_NAME">,
    "_FEATURE_FLAG",
    "featureFlags"
  >
> {
  const logger = getLogger();

  if (cachedConfig.has(validator)) {
    logger.info("Returning cached configuration");

    // This is safe because we only set values of this type in the cache.
    return cachedConfig.get(validator) as FoldSuffixInto<
      WithoutPropSuffix<T, "_PARAM_NAME">,
      "_FEATURE_FLAG",
      "featureFlags"
    >;
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

  const populatedParams = await populateParameterFields(
    removeFeatureFlags(rawConfigSchemaCheck.data),
  );

  const featureFlags = extractFeatureFlags(rawConfigSchemaCheck.data);

  const finalConfig = {
    ...populatedParams,
    featureFlags: featureFlags,
  } as FoldSuffixInto<
    WithoutPropSuffix<T, "_PARAM_NAME">,
    "_FEATURE_FLAG",
    "featureFlags"
  >;

  cachedConfig.set(validator, finalConfig);

  return finalConfig;
}
