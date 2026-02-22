import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { getLogger } from "@flex/logging";
import type {
  OmitPropsWithSuffix,
  OnlyPropsWithSuffix,
  Simplify,
  WithoutPropSuffix,
  WithoutSuffix,
} from "@flex/utils";
import { z } from "zod";

export function splitBySuffix<T extends object, SUFFIX extends string>(
  obj: T,
  suffix: SUFFIX,
): [
  Simplify<OnlyPropsWithSuffix<T, SUFFIX>>,
  Simplify<OmitPropsWithSuffix<T, SUFFIX>>,
] {
  const [withSuffix, withoutSuffix] = Object.entries(obj).reduce<
    [Record<string, unknown>, Record<string, unknown>]
  >(
    ([withSuffix, withoutSuffix], [key, value]) => {
      const entryObject = key.endsWith(suffix) ? withSuffix : withoutSuffix;
      entryObject[key] = value;
      return [withSuffix, withoutSuffix];
    },
    [{}, {}],
  );

  return [
    withSuffix as Simplify<OnlyPropsWithSuffix<T, SUFFIX>>,
    withoutSuffix as Simplify<OmitPropsWithSuffix<T, SUFFIX>>,
  ];
}

function removeSuffixFromFields<T extends object, SUFFIX extends string>(
  object: T,
  suffix: SUFFIX,
): WithoutPropSuffix<T, SUFFIX> {
  const entriesWithoutSuffix = Object.entries(object).map(([key, value]) => {
    if (key.endsWith(suffix)) {
      return [key.slice(0, -suffix.length), value] as [string, unknown];
    }
    return [key, value] as [string, unknown];
  });

  return Object.fromEntries(entriesWithoutSuffix) as WithoutPropSuffix<
    T,
    SUFFIX
  >;
}

/**
 * Populates parameter fields suffixed with _PARAM_NAME in the raw configuration by fetching their actual values from SSM.
 * Renames the fields to remove the _PARAM_NAME suffix in the returned parsed configuration.
 *
 * @param rawConfig The raw configuration object containing parameter names.
 * @returns The parsed configuration object with parameter values populated.
 */
async function populateParameterFields<T extends Record<string, string>>(
  params: T,
) {
  const logger = getLogger();

  const [invertedParamsEntries, listOfParameterNames] = Object.entries(
    params,
  ).reduce<[Record<string, string>, string[]]>(
    ([invertedParams, paramsList], [key, value]) => {
      paramsList.push(value);
      invertedParams[value] = key;
      return [invertedParams, paramsList] as [Record<string, string>, string[]];
    },
    [{}, []],
  );

  const populatedParameters = await getParametersByName(
    Object.fromEntries(
      listOfParameterNames.map((parameterName) => [parameterName, {}]),
    ),
    { decrypt: true },
  );

  const populatedConfigEntries = listOfParameterNames.map((parameterName) => {
    const key = invertedParamsEntries[parameterName];
    const parameterValue = populatedParameters[parameterName];

    if (typeof parameterValue !== "string") {
      const message = `Parameter ${parameterName} not found or is not a string`;
      logger.error(message);
      throw new Error(message);
    }

    return [key, parameterValue] as [string, string];
  });

  const parsedParameters = removeSuffixFromFields(
    Object.fromEntries(populatedConfigEntries),
    "_PARAM_NAME",
  );

  return parsedParameters as Simplify<WithoutPropSuffix<T, "_PARAM_NAME">>;
}

/**
 * Extracts feature flag fields from the raw configuration, renames them by removing the _FEATURE_FLAG suffix, and returns them in a new object.
 *
 * @param featureFlagConfigs The raw configuration object containing feature flags.
 * @returns The extracted feature flags.
 */
function populateFeatureFlags<T extends object>(
  featureFlagConfigs: T,
): Simplify<WithoutPropSuffix<T, "_FEATURE_FLAG">> {
  const featureFlagEntries = Object.entries(featureFlagConfigs);

  const normalisedFeatureFlagEntries = featureFlagEntries.map(
    ([key, value]) => [
      key,
      // note that this condition catches null and undefined just to be on the safe side.
      // In practice, set environment variables can only be strings. null and undefined values
      // seem to be converted to the strings "null" and "undefined" respectively.
      Boolean(value) &&
        value !== "false" &&
        value !== "0" &&
        value !== "null" &&
        value !== "undefined",
    ],
  );

  return removeSuffixFromFields(
    Object.fromEntries(normalisedFeatureFlagEntries),
    "_FEATURE_FLAG",
  ) as Simplify<WithoutPropSuffix<T, "_FEATURE_FLAG">>;
}

async function populateSecrets<T extends object>(
  secretsConfig: T,
): Promise<Simplify<WithoutPropSuffix<T, "_SECRET">>> {
  const secretEntries = Object.entries(secretsConfig);

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
}

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
      secretsOnly: Simplify<
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

  const populatedParameters = await populateParameterFields(parametersOnly);

  const [featureFlagsOnly, nonFeatureFlagConfig] = splitBySuffix(
    nonParameterConfig,
    "_FEATURE_FLAG",
  );
  const populatedFeatureFlags = populateFeatureFlags(featureFlagsOnly);

  const [secretsOnly, envvars] = splitBySuffix(nonFeatureFlagConfig, "_SECRET");
  const populatedSecrets = await populateSecrets(secretsOnly);

  const finalConfig = {
    parameters: populatedParameters,
    featureFlags: populatedFeatureFlags,
    secretsOnly: populatedSecrets,
    envvars,
  };

  cachedConfig.set(validator, finalConfig);

  return finalConfig;
}
