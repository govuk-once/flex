import type { DeepPartial } from "@flex/utils";
import type { Context } from "aws-lambda";
import { mergeDeepLeft } from "ramda";

type ContextOverrides = DeepPartial<Context>;

const baseContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: "test-function",
  functionVersion: "1",
  invokedFunctionArn:
    "arn:aws:lambda:eu-west-2:123456789012:function:test-function",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/test-function",
  logStreamName: "2025/01/15/[$LATEST]test-request-id",
  getRemainingTimeInMillis: () => 30_000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

function build(overrides: ContextOverrides = {}) {
  return mergeDeepLeft(overrides, baseContext) as Context;
}

export function createContext() {
  return {
    create: (overrides?: ContextOverrides) => build(overrides),
  };
}

export const context = build();
