import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { getLogger } from "@flex/logging";
import { Simplify, WithoutPropSuffix } from "@flex/utils";

import { removeSuffixFromFields } from "./utils";

/**
 * Populates parameter fields suffixed with _PARAM_NAME in the raw configuration by fetching their actual values from SSM.
 * Renames the fields to remove the _PARAM_NAME suffix in the returned parsed configuration.
 *
 * @param rawConfig The raw configuration object containing parameter names.
 * @returns The parsed configuration object with parameter values populated.
 */
export async function populateParameterFields<T extends Record<string, string>>(
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

  logger.debug(
    `Fetching parameter values from SSM for parameters:\n\t${listOfParameterNames.join(
      ",\n\t",
    )}`,
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
