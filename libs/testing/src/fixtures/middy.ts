// middy.ts

import type { Request } from "@middy/core";
import type { Context } from "aws-lambda";

const baseMiddyRequest = <
  TEvent = unknown,
  TResult = unknown,
  TError = Error,
  TContext extends Context = Context,
>(
  overrides?: Partial<Request<TEvent, TResult, TError, TContext>>,
): Request<TEvent, TResult, TError, TContext> =>
  ({
    ...overrides,
    event: overrides?.event as unknown as TEvent,
  }) as Request<TEvent, TResult, TError, TContext>;

export const createMiddyRequest = baseMiddyRequest;
