import {
  CloudFormationClient,
  DescribeStackResourcesCommand,
} from "@aws-sdk/client-cloudformation";
import {
  GetFunctionConfigurationCommand,
  LambdaClient,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionUpdatedV2,
} from "@aws-sdk/client-lambda";
import { getStackOutputs } from "@flex/utils";

import { getJwtClient } from "../../tests/e2e/src/setup.global";

const RESET_VARIABLE = "COLD_START_RESET_AT";
const CASCADE_PATH = "/app/cold-start/v1/cascade";

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

export async function recycleStack(
  region: string,
  stackName: string,
): Promise<string[]> {
  const cfn = new CloudFormationClient({ region });
  const lambda = new LambdaClient({ region });

  const functionNames = await listStackFunctions(cfn, stackName);

  if (functionNames.length === 0) {
    throw new Error(`No Lambda functions found in stack "${stackName}"`);
  }

  const stamp = String(Date.now());

  await Promise.all(
    functionNames.map(async (functionName) => {
      const { Environment } = await lambda.send(
        new GetFunctionConfigurationCommand({ FunctionName: functionName }),
      );

      await lambda.send(
        new UpdateFunctionConfigurationCommand({
          FunctionName: functionName,
          Environment: {
            Variables: { ...Environment?.Variables, [RESET_VARIABLE]: stamp },
          },
        }),
      );

      await waitUntilFunctionUpdatedV2(
        { client: lambda, maxWaitTime: 60 },
        { FunctionName: functionName },
      );
    }),
  );

  return functionNames;
}

export async function resolveCascadeUrl(stage: string): Promise<string> {
  const { FlexApiUrl } = await getStackOutputs(
    `${stage}-FlexGlobal`,
    "us-east-1",
  );

  if (!FlexApiUrl) {
    throw new Error(`FlexApiUrl not found in "${stage}-FlexGlobal" outputs`);
  }

  return `${FlexApiUrl}${CASCADE_PATH}`;
}

export async function getCascadeToken(stage: string): Promise<string> {
  const client = await getJwtClient(stage);
  return client.getToken();
}

export interface CascadeResult {
  readonly status: number;
  readonly timeMs: number;
  readonly body: string;
}

export async function callCascade(
  cascadeUrl: string,
  token: string,
  delays: string,
): Promise<CascadeResult> {
  const url = `${cascadeUrl}?delays=${encodeURIComponent(delays)}`;

  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.text();

  return {
    status: response.status,
    timeMs: Math.round(performance.now() - startedAt),
    body,
  };
}
