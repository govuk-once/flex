import { getEnvConfig } from "@platform/gov-uk-once";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import crypto from "crypto";

const envConfig = getEnvConfig();

function getParamName(name: string) {
  return `/${envConfig.environment}${name}`;
}

function hash(string: string) {
  return crypto.createHash("md5").update(string).digest("hex").slice(0, 16);
}

/** Flex Secrets */
export type FlexPlatformParam = "/flex-core/private-gateway/url";

export function exportFlexPlatformParam(
  scope: Construct,
  param: FlexPlatformParam,
  value: string,
) {
  new StringParameter(scope, `FlexParam${hash(param)}`, {
    parameterName: getParamName(param),
    stringValue: value,
  });
}

export function importFlexPlatformParam(
  scope: Construct,
  param: FlexPlatformParam,
) {
  return StringParameter.fromStringParameterName(
    scope,
    `FlexParam${hash(param)}`,
    getParamName(param),
  );
}
