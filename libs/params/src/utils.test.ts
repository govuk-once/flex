import { describe, expect, it } from "vitest";

import { removeSuffixFromFields, splitBySuffix } from "./utils";

describe("Utils", () => {
  describe("splitBySuffix", () => {
    it("should split an object into two based on a suffix", () => {
      const input = {
        PARAM1_PARAM_NAME: "param1",
        PARAM2_PARAM_NAME: "param2",
        FEATURE_FLAG1_FEATURE_FLAG: "featureFlag1",
        SECRET1_SECRET: "notpublicinformation", // pragma: allowlist secret
        ENV_VAR1: "envVar1",
      };

      const [params, nonParams] = splitBySuffix(input, "_PARAM_NAME");

      expect(params).toEqual({
        PARAM1_PARAM_NAME: "param1",
        PARAM2_PARAM_NAME: "param2",
      });

      expect(nonParams).toEqual({
        FEATURE_FLAG1_FEATURE_FLAG: "featureFlag1",
        SECRET1_SECRET: "notpublicinformation", // pragma: allowlist secret
        ENV_VAR1: "envVar1",
      });
    });
  });

  describe("removeSuffixFromFields", () => {
    it("should remove the specified suffix from the keys of an object", () => {
      const input = {
        PARAM1_PARAM_NAME: "param1",
        PARAM2_PARAM_NAME: "param2",
        FEATURE_FLAG1_FEATURE_FLAG: "featureFlag1",
        SECRET1_SECRET: "notpublicinformation", // pragma: allowlist secret
        ENV_VAR1: "envVar1",
      };

      const result = removeSuffixFromFields(input, "_PARAM_NAME");

      expect(result).toEqual({
        PARAM1: "param1",
        PARAM2: "param2",
        FEATURE_FLAG1_FEATURE_FLAG: "featureFlag1",
        SECRET1_SECRET: "notpublicinformation", // pragma: allowlist secret
        ENV_VAR1: "envVar1",
      });
    });
  });
});
