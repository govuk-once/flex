import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { getLogger } from "@flex/logging";
import { z } from "zod";

export const rawConfigSchema = z.looseObject({
  AWS_REGION: z.string().min(1),
  USERPOOL_ID_PARAM_NAME: z.string().min(1),
  CLIENT_ID_PARAM_NAME: z.string().min(1),
});

export type RawConfig = z.infer<typeof rawConfigSchema>;

export const parsedConfigSchema = z.looseObject({
  AWS_REGION: z.string().min(1),
  USERPOOL_ID: z.string().min(1),
  CLIENT_ID: z.string().min(1),
});

export type ParsedConfig = z.infer<typeof parsedConfigSchema>;

/**
 * Populates parameter fields suffixed with _PARAM_NAME in the raw configuration by fetching their actual values from SSM.
 * Renames the fields to remove the _PARAM_NAME suffix in the returned parsed configuration.
 *
 * @param rawConfig The raw configuration object containing parameter names.
 * @returns The parsed configuration object with parameter values populated.
 */
async function populateParameterFields(rawConfig: RawConfig) {
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

    return [key.replace("_PARAM_NAME", ""), parameterValue] as [string, string];
  });

  const parsedConfig = Object.fromEntries([
    ...populatedConfigEntries,
    ...nonParameterNames,
  ]);
  const parsedConfigSchemaCheck = parsedConfigSchema.safeParse(parsedConfig);

  if (!parsedConfigSchemaCheck.success) {
    // Note: it should be impossible to get here if the schemas are correct, but we include this for type narrowing and belt-and-braces safety.
    const message = `Invalid parsed configuration: ${JSON.stringify(z.treeifyError(parsedConfigSchemaCheck.error))}`;
    logger.error(message);
    throw new Error(message);
  }

  return parsedConfigSchemaCheck.data;
}

let cachedConfig: ParsedConfig | null = null;

/**
 * Retrieves the parsed configuration, using a cached version if available. Replaces any parameter name fields with their actual values from SSM.
 *
 * @returns The parsed, populated configuration object.
 */
export async function getConfig(): Promise<ParsedConfig> {
  const logger = getLogger();

  if (cachedConfig) {
    logger.info("Returning cached configuration");
    return cachedConfig;
  }

  logger.info(
    "cachedConfig not found, building configuration from process.env and SSM",
  );
  const rawConfigSchemaCheck = rawConfigSchema.safeParse(process.env);

  if (!rawConfigSchemaCheck.success) {
    const message = `Invalid raw configuration: ${JSON.stringify(z.treeifyError(rawConfigSchemaCheck.error))}`;
    logger.error(message);
    throw new Error(message);
  }

  return (cachedConfig = await populateParameterFields(
    rawConfigSchemaCheck.data,
  ));
}
