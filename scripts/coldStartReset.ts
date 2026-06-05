import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import {
  LambdaClient,
  UpdateFunctionConfigurationCommand,
  GetFunctionConfigurationCommand,
  waitUntilFunctionUpdatedV2,
} from "@aws-sdk/client-lambda";

import { coldStartStackName, listStackFunctions } from "./lib/coldStart";

const RESET_VARIABLE = "COLD_START_RESET_AT";

async function recycleFunction(
  lambda: LambdaClient,
  functionName: string,
  stamp: string,
): Promise<void> {
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

  console.log(`recycled ${functionName}`);
}

async function main(): Promise<void> {
  const stage = process.env.STAGE ?? "development";
  const region = process.env.AWS_REGION ?? "eu-west-2";
  const stackName = coldStartStackName(stage);

  const cfn = new CloudFormationClient({ region });
  const lambda = new LambdaClient({ region });

  const functionNames = await listStackFunctions(cfn, stackName);

  if (functionNames.length === 0) {
    throw new Error(`No Lambda functions found in stack "${stackName}"`);
  }

  const stamp = String(Date.now());

  await Promise.all(
    functionNames.map((functionName) =>
      recycleFunction(lambda, functionName, stamp),
    ),
  );

  console.log(
    `\nRecycled ${functionNames.length} function(s) in "${stackName}". The next invocation of each will cold start.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
