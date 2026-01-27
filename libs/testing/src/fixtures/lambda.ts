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
export function createContext<T extends Context = Context>(
  overrides: DeepPartial<T> = {} as DeepPartial<T>,
) {
  /**
   * Helper function that creates a new context builder with accumulated overrides.
   * This enables the recursive pattern where each `withX` method returns a new builder
   * with the previous overrides plus the new property.
   */
  const withOverrides = <U extends Context>(next: DeepPartial<U>) =>
    createContext<U>(next);

  return {
    /**
     * Resolves the final context by merging all accumulated overrides with the base context.
     * Any extra overrides passed here will be merged with the accumulated ones.
     */
    create(extraOverrides?: DeepPartial<T>) {
      // Final, accumulated overrides win over later `create`-time overrides
      return buildContext({
        ...overrides,
        ...extraOverrides,
      } as DeepPartial<T>);
    },

    /**
     * Returns a new builder with the pairwiseId added to the accumulated overrides.
     */
    withPairwiseId(pairwiseId = "test-pairwise-id") {
      const next = {
        ...overrides,
        pairwiseId,
      } as DeepPartial<T & ContextWithPairwiseId>;

      return withOverrides<T & ContextWithPairwiseId>(next);
    },

    /**
     * Returns a new builder with the secretKey added to the accumulated overrides.
     */
    withSecret(secrets: Record<string, string>) {
      const next = {
        ...overrides,
        ...secrets,
      } as DeepPartial<T & Record<string, string>>;

      return withOverrides<T & Record<string, string>>(next);
    },
  } as const;
}

export const context = buildContext();
