import type { DeepPartial } from "@flex/utils";
import type { Request } from "@middy/core";
import type { Context } from "aws-lambda";
import { mergeDeepLeft } from "ramda";

import type { EventWithAuthorizer } from "./apigateway";
import { createEventWithAuthorizer, eventWithAuthorizer } from "./apigateway";
import type { ContextOverrides } from "./lambda";
import { createContext } from "./lambda";

export type MiddyRequest<
  Event extends EventWithAuthorizer = EventWithAuthorizer,
  Result = unknown,
> = Request<Event, Result, Error, Context>;

export interface MiddyRequestOverrides<
  Event extends EventWithAuthorizer = EventWithAuthorizer,
  Result = unknown,
> {
  event?: DeepPartial<Event>;
  context?: ContextOverrides;
  response?: Result | null;
  error?: Error | null;
  internal?: Record<string, unknown>;
}

function buildMiddyRequest<
  Event extends EventWithAuthorizer = EventWithAuthorizer,
  Result = unknown,
>(overrides: MiddyRequestOverrides<Event, Result> = {}) {
  return mergeDeepLeft(overrides, {
    event: eventWithAuthorizer,
    context: createContext().create(),
    response: null,
    error: null,
    internal: {},
  }) as MiddyRequest<Event, Result>;
}

const {
  authenticated: authenticatedEventWithAuthorizer,
  unauthenticated: unauthenticatedEventWithAuthorizer,
} = createEventWithAuthorizer();

export function createMiddyRequest() {
  return {
    create: <Event extends EventWithAuthorizer, Result>(
      overrides?: MiddyRequestOverrides<Event, Result>,
    ) => buildMiddyRequest<Event, Result>(overrides),
    authenticated: (pairwiseId = "test-pairwise-id") =>
      buildMiddyRequest({
        event: authenticatedEventWithAuthorizer(pairwiseId),
      }),
    unauthenticated: () =>
      buildMiddyRequest({ event: unauthenticatedEventWithAuthorizer() }),
    withEvent: <Event extends EventWithAuthorizer>(event: DeepPartial<Event>) =>
      buildMiddyRequest<Event>({ event }),
    withContext: (context: ContextOverrides) => buildMiddyRequest({ context }),
    withResponse: <Result>(response: Result) =>
      buildMiddyRequest<EventWithAuthorizer, Result>({ response }),
    withError: (error: Error) => buildMiddyRequest({ error }),
  };
}

export const middyRequest = buildMiddyRequest();
