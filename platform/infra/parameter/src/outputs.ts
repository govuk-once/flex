import { getEnvConfig } from "@platform/gov-uk-once";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

const envConfig = getEnvConfig();

export function generateParamName(name: string) {
  // /development/flex-parameter/auth/user_pool_id
  return `/${envConfig.environment}/flex-parameter${name}`;
}

export function getFlexSecretNamePrefix(name: string) {
  return `/${envConfig.environment}/flex-secret${name}`;
}

const AuthKeys = {
  userPoolId: generateParamName("/auth/user_pool_id"),
  clientId: generateParamName("/auth/client_id"),
} as const;

export function exportAuthParametersToSsm(scope: Construct) {
  new StringParameter(scope, "UserPoolId", {
    parameterName: AuthKeys.userPoolId,
    stringValue: "placeholder",
  });

  new StringParameter(scope, "ClientId", {
    parameterName: AuthKeys.clientId,
    stringValue: "placeholder",
  });
}

export function importAuthParametersFromSsm() {
  return {
    userPoolId: AuthKeys.userPoolId,
    clientId: AuthKeys.clientId,
  };
}
