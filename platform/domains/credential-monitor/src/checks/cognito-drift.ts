import { logger } from "@flex/logging";

import { publishMetric } from "../aws/cloudwatch";
import { getFunctionEnvironment } from "../aws/lambda";
import { getParameterValue } from "../aws/ssm";
import type { CognitoParameter } from "../config";
import { MetricName } from "../metrics";

interface CognitoDriftCheckProps {
  environment: string;
  authorizerFunctionArn: string;
  cognitoParameters: CognitoParameter[];
}

export async function checkCognitoDrift({
  environment,
  authorizerFunctionArn,
  cognitoParameters,
}: CognitoDriftCheckProps): Promise<void> {
  const [deployedEnvironment, parameterValues] = await Promise.all([
    getFunctionEnvironment(authorizerFunctionArn),
    Promise.all(
      cognitoParameters.map(({ parameterName }) =>
        getParameterValue(parameterName),
      ),
    ),
  ]);

  const drifted = cognitoParameters.filter(
    ({ environmentVariable }, index) =>
      deployedEnvironment[environmentVariable] !== parameterValues[index],
  );

  if (drifted.length > 0) {
    logger.warn(
      "Cognito configuration in SSM differs from the deployed authorizer, a deployment is required",
      { drifted },
    );
  }

  await publishMetric(
    environment,
    MetricName.CognitoConfigDrift,
    drifted.length,
  );
}
