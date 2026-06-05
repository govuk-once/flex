import {
  CloudFormationClient,
  DescribeStackResourcesCommand,
} from "@aws-sdk/client-cloudformation";
import {
  GetFunctionConfigurationCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";

export function coldStartStackName(stage: string): string {
  return `${stage}-cold-start`;
}

export async function listStackFunctions(
  cfn: CloudFormationClient,
  stackName: string,
): Promise<string[]> {
  const { StackResources } = await cfn.send(
    new DescribeStackResourcesCommand({ StackName: stackName }),
  );

  return (StackResources ?? [])
    .filter(
      (resource) =>
        resource.ResourceType === "AWS::Lambda::Function" &&
        Boolean(resource.PhysicalResourceId),
    )
    .map((resource) => resource.PhysicalResourceId as string);
}

export async function getLogGroups(
  lambda: LambdaClient,
  functionNames: string[],
): Promise<string[]> {
  const configs = await Promise.all(
    functionNames.map((functionName) =>
      lambda.send(
        new GetFunctionConfigurationCommand({ FunctionName: functionName }),
      ),
    ),
  );

  return configs
    .map((config) => config.LoggingConfig?.LogGroup)
    .filter((group): group is string => Boolean(group));
}
