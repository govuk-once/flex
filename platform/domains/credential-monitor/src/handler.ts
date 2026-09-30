import { logger } from "@flex/logging";

import { publishMetric } from "./aws/cloudwatch";
import { checkCognitoDrift } from "./checks/cognito-drift";
import { checkSecretRotation } from "./checks/secret-rotation";
import { loadConfig } from "./config";
import { MetricName } from "./metrics";

export async function handler(): Promise<void> {
  logger.setServiceName("credential-monitor");

  const {
    FLEX_ENVIRONMENT: environment,
    AUTHORIZER_FUNCTION_ARN: authorizerFunctionArn,
    MANUAL_ROTATION_SECRETS: manualRotationSecrets,
    COGNITO_PARAMETERS: cognitoParameters,
  } = loadConfig();

  const results = await Promise.allSettled([
    checkSecretRotation({
      environment,
      manualRotationSecrets,
      now: new Date(),
    }),
    checkCognitoDrift({
      environment,
      authorizerFunctionArn,
      cognitoParameters,
    }),
  ]);

  const failures = results
    .filter((result) => result.status === "rejected")
    .map(({ reason }: PromiseRejectedResult): unknown => reason);

  if (failures.length > 0) {
    logger.error("Credential monitor checks failed", { failures });
    throw new AggregateError(failures, "Credential monitor checks failed");
  }

  await publishMetric(environment, MetricName.CredentialMonitorSuccess, 1);
}
