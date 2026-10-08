import {
  GetFunctionConfigurationCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getFunctionEnvironment } from "./lambda";

const lambda = mockClient(LambdaClient);

const functionArn = "arn:aws:lambda:eu-west-2:123456789012:function:authorizer";

describe("getFunctionEnvironment", () => {
  beforeEach(() => {
    lambda.reset();
  });

  afterAll(() => {
    lambda.restore();
  });

  it("returns the function's environment variables", async () => {
    lambda
      .on(GetFunctionConfigurationCommand, { FunctionName: functionArn })
      .resolves({ Environment: { Variables: { CLIENT_ID: "client-123" } } });

    await expect(getFunctionEnvironment(functionArn)).resolves.toEqual({
      CLIENT_ID: "client-123",
    });
  });

  it("returns an empty object when the function has no environment", async () => {
    lambda.on(GetFunctionConfigurationCommand).resolves({});

    await expect(getFunctionEnvironment(functionArn)).resolves.toEqual({});
  });

  it("throws when Lambda could not decrypt the environment", async () => {
    lambda.on(GetFunctionConfigurationCommand).resolves({
      Environment: {
        Error: {
          ErrorCode: "AccessDeniedException",
          Message: "Lambda was unable to decrypt the environment variables",
        },
      },
    });

    await expect(getFunctionEnvironment(functionArn)).rejects.toThrow(
      `Unable to read environment of ${functionArn}: AccessDeniedException`,
    );
  });

  it("throws with an unknown error when the error has no code", async () => {
    lambda
      .on(GetFunctionConfigurationCommand)
      .resolves({ Environment: { Error: {} } });

    await expect(getFunctionEnvironment(functionArn)).rejects.toThrow(
      "unknown error",
    );
  });
});
