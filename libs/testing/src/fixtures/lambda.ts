import type { DeepPartial } from "@flex/utils";
import type { Context } from "aws-lambda";
import { mergeDeepLeft } from "ramda";

export type ContextOverrides = DeepPartial<Context>;

const baseContext: Context = {
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

function buildContext<T extends Context = Context>(
  overrides: DeepPartial<T> = {} as DeepPartial<T>,
): T {
  return mergeDeepLeft(overrides, baseContext) as unknown as T;
}

export interface ContextWithPairwiseId extends Context {
  pairwiseId: string;
}

export interface ContextWithSecret extends Context {
  secretKey: string;
}

export function createContext<T extends Context = Context>(
  overrides: DeepPartial<T> = {} as DeepPartial<T>,
) {
  const withOverrides = <U extends Context>(next: DeepPartial<U>) =>
    createContext<U>(next);

  return {
    create(extraOverrides?: DeepPartial<T>) {
      // Final, accumulated overrides win over later `create`-time overrides
      return buildContext({
        ...overrides,
        ...extraOverrides,
      } as DeepPartial<T>);
    },

    withPairwiseId(pairwiseId = "test-pairwise-id") {
      const next = {
        ...overrides,
        pairwiseId,
      } as DeepPartial<T & ContextWithPairwiseId>;

      return withOverrides<T & ContextWithPairwiseId>(next);
    },

    withSecret(secret: string) {
      const next = {
        ...overrides,
        secretKey: secret,
      } as DeepPartial<T & ContextWithSecret>;

      return withOverrides<T & ContextWithSecret>(next);
    },
  } as const;
}
