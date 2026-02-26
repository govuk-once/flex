import type { DeepPartial } from "@flex/utils";
import type { Request } from "@middy/core";
import { mergeDeepLeft } from "ramda";

import type {
  RestApiEventWithAuthorizer,
  RestApiEventWithAuthorizerOverrides,
} from "./apigateway";
import {
  createRestApiEventWithAuthorizer,
  restApiEventWithAuthorizer,
} from "./apigateway";
import type { ContextOverrides, ContextWithPairwiseId } from "./lambda";
import { context } from "./lambda";

export type MiddyRequest<
  Event extends RestApiEventWithAuthorizer = RestApiEventWithAuthorizer,
  Result = unknown,
> = Request<Event, Result, Error, ContextWithPairwiseId>;

export interface MiddyRequestOverrides<
  Event extends RestApiEventWithAuthorizer = RestApiEventWithAuthorizer,
  Result = unknown,
> {
  event?: DeepPartial<Event>;
  context?: ContextOverrides;
  response?: Result | null;
  error?: Error | null;
  internal?: Record<string, unknown>;
}

function buildMiddyRequest<
  Event extends RestApiEventWithAuthorizer = RestApiEventWithAuthorizer,
  Result = unknown,
>(overrides: MiddyRequestOverrides<Event, Result> = {}) {
  return mergeDeepLeft(overrides, {
    event: restApiEventWithAuthorizer,
    context,
    response: null,
    error: null,
    internal: {},
  }) as MiddyRequest<Event, Result>;
}

const {
  authenticated: authenticatedRestApiEventWithAuthorizer,
  unauthenticated: unauthenticatedRestApiEventWithAuthorizer,
} = createRestApiEventWithAuthorizer();

export function createMiddyRequest() {
  return {
    create: <Event extends RestApiEventWithAuthorizer, Result>(
      overrides?: MiddyRequestOverrides<Event, Result>,
    ) => buildMiddyRequest<Event, Result>(overrides),
    authenticated: (
      overrides?: RestApiEventWithAuthorizerOverrides,
      pairwiseId = "test-pairwise-id",
    ) =>
      buildMiddyRequest({
        event: authenticatedRestApiEventWithAuthorizer(overrides, pairwiseId),
      }),
    unauthenticated: () =>
      buildMiddyRequest({
        event: unauthenticatedRestApiEventWithAuthorizer(),
      }),
    withEvent: <Event extends RestApiEventWithAuthorizer>(
      event: DeepPartial<Event>,
    ) => buildMiddyRequest<Event>({ event }),
    withContext: (context: ContextOverrides) => buildMiddyRequest({ context }),
    withResponse: <Result>(response: Result) =>
      buildMiddyRequest<RestApiEventWithAuthorizer, Result>({ response }),
    withError: (error: Error) => buildMiddyRequest({ error }),
  };
}

export const middyRequest = buildMiddyRequest();
