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

function buildContext(overrides?: DeepPartial<ContextWithPairwiseId>) {
  return mergeDeepLeft(overrides ?? {}, baseContext) as ContextWithPairwiseId;
}

export interface ContextWithPairwiseId extends Context {
  pairwiseId: string;
}

type Secrets = Record<string, unknown>;

class BuildContext {
  overrides?: DeepPartial<Context> & Partial<Secrets>;
  pairwiseId?: string = undefined;
  secrets?: Secrets = undefined;

  constructor(overrides?: DeepPartial<Context> & Partial<Secrets>) {
    this.overrides = overrides;
  }

  withPairwiseId(pairwiseId: string = "test-pairwise-id") {
    this.pairwiseId = pairwiseId;
    return this;
  }

  withSecret(secrets: Record<string, unknown>) {
    this.secrets = secrets;
    return this;
  }

  create(overrides?: DeepPartial<Context>) {
    return buildContext({
      ...this.overrides,
      ...this.secrets,
      pairwiseId: this.pairwiseId,
      ...overrides,
    });
  }
}

/**
 * Creates a context builder with a fluent API for constructing test Lambda contexts.
 *
 * The builder uses a recursive pattern where:
 * - Each `withX` method (e.g., `withPairwiseId`, `withSecret`) returns a new builder
 *   instance with accumulated overrides, allowing method chaining.
 * - The `create()` method resolves the final context by merging all accumulated
 *   overrides with the base context.
 *
 * Example usage:
 * ```typescript
 * const ctx = createContext()
 *   .withPairwiseId("user-123")
 *   .withSecret("my-secret")
 *   .create();
 * ```
 */
export function createContext(overrides?: DeepPartial<Context>) {
  const builder = new BuildContext(overrides);
  return builder;
}

export const context = buildContext();
