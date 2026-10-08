import {
  GetFunctionConfigurationCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";

const client = new LambdaClient({});

export async function getFunctionEnvironment(
  functionName: string,
): Promise<Record<string, string>> {
  const response = await client.send(
    new GetFunctionConfigurationCommand({ FunctionName: functionName }),
  );

  const error = response.Environment?.Error;
  if (error) {
    throw new Error(
      `Unable to read environment of ${functionName}: ${error.ErrorCode ?? "unknown error"}`,
    );
  }

  return response.Environment?.Variables ?? {};
}
