import type { FunctionConfig } from "@flex/sdk";
import { Duration } from "aws-cdk-lib";

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
