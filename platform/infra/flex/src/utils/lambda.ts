import type { FunctionConfig } from "@flex/sdk";
import { Duration } from "aws-cdk-lib";
import { type IKey, Key } from "aws-cdk-lib/aws-kms";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

import { ENV_KEYS } from "../ssm-keys";

export function resolveEncryptionKey(scope: Construct): IKey {
  const encryptionKeyArn = StringParameter.valueForStringParameter(
    scope,
    ENV_KEYS.FlexEncryptionKey,
  );
  return Key.fromKeyArn(scope, "FlexEncryptionKey", encryptionKeyArn);
}

export function toFunctionConfig(
  route?: FunctionConfig,
  common?: FunctionConfig,
) {
  const environment = { ...common?.environment, ...route?.environment };
  const memorySize = route?.memorySize ?? common?.memorySize;
  const timeoutSeconds = route?.timeoutSeconds ?? common?.timeoutSeconds ?? 15;

  return {
    ...(Object.keys(environment).length > 0 && { environment }),
    ...(memorySize && { memorySize }),
    ...(timeoutSeconds && { timeout: Duration.seconds(timeoutSeconds) }),
  };
}
