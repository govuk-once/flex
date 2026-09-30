import { getFunctionEnvironment } from "../aws/lambda";
import { getParameterValue } from "../aws/ssm";
import type { CognitoParameter } from "../config";
import { MetricName } from "../metrics";
import { reportCount } from "../report";

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

  await reportCount({
    environment,
    metricName: MetricName.CognitoConfigDrift,
    message:
      "Cognito configuration in SSM differs from the deployed authorizer, a deployment is required",
    detailKey: "drifted",
    items: cognitoParameters.filter(
      ({ environmentVariable }, index) =>
        deployedEnvironment[environmentVariable] !== parameterValues[index],
    ),
  });
}
