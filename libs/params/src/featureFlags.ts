import { Simplify, WithoutPropSuffix } from "@flex/utils";

import { removeSuffixFromFields } from "./utils";

/**
 * Extracts feature flag fields from the raw configuration, renames them by removing the _FEATURE_FLAG suffix, and returns them in a new object.
 *
 * @param featureFlagConfigs The raw configuration object containing feature flags.
 * @returns The extracted feature flags.
 */
export function populateFeatureFlags<T extends object>(
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
