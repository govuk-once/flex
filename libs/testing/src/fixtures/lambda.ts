import type { DeepPartial } from "@flex/utils";
import type { Context } from "aws-lambda";

import { createFixtureBuilder } from "../utils/fixtures";

export type ContextOverrides = DeepPartial<Context>;

export const baseLambdaContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test-function",
  functionVersion: "$LATEST",
  invokedFunctionArn:
    "arn:aws:lambda:eu-west-2:123456789012:function:test-function",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/test-function",
  logStreamName: "2026/01/01/[$LATEST]test-request-id",
  getRemainingTimeInMillis: () => 30_000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

export const buildLambdaContext = createFixtureBuilder(baseLambdaContext);

export type LambdaContextFactory = typeof buildLambdaContext;
