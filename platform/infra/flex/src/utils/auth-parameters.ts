import { Environment, getEnvConfig } from "@flex/utils";

import { ENV_KEYS } from "../ssm-keys";

const { env } = getEnvConfig();

export function getAuthorizerParameterKeys() {
  return env === Environment.development
    ? {
        userPoolId: ENV_KEYS.AuthUserPoolIdStub,
        clientId: ENV_KEYS.AuthClientIdStub,
      }
    : {
        userPoolId: ENV_KEYS.AuthUserPoolId,
        clientId: ENV_KEYS.AuthClientId,
      };
}
