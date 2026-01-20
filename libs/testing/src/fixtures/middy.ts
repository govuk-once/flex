import type { DeepPartial } from "@flex/utils";
import type { Request } from "@middy/core";
import type { Context } from "aws-lambda";
import { mergeDeepLeft } from "ramda";

import {
  apiGatewayRequestWithAuthorizer,
  createAPIGatewayRequestWithAuthorizer,
} from "./apigateway";
import { context } from "./lambda";

type MiddyRequestOverrides<TEvent = typeof apiGatewayRequestWithAuthorizer> =
  DeepPartial<
    Omit<Request<TEvent, unknown, Error, Context>, "event" | "context">
  > & {
    event?: DeepPartial<TEvent>;
    context?: DeepPartial<Context>;
  };

const baseMiddyRequest = {
  event: apiGatewayRequestWithAuthorizer,
  context: context,
  internal: {},
  response: null,
  error: null,
} as const;

function buildMiddyRequest<TEvent = typeof apiGatewayRequestWithAuthorizer>(
  overrides: MiddyRequestOverrides<TEvent> = {},
): Request<TEvent, unknown, Error> {
  return mergeDeepLeft(overrides, baseMiddyRequest) as Request<
    TEvent,
    unknown,
    Error
  >;
}

export function createMiddyRequest() {
  return {
    create: <TEvent = typeof apiGatewayRequestWithAuthorizer>(
      overrides?: MiddyRequestOverrides<TEvent>,
    ) => buildMiddyRequest<TEvent>(overrides),
  };
}

export const middyRequest = baseMiddyRequest;

export const middyRequests = {
  authenticated: createMiddyRequest().create(),
  unauthenticated: createMiddyRequest().create({
    event: createAPIGatewayRequestWithAuthorizer().create({
      requestContext: {
        authorizer: {
          lambda: {
            pairwiseId: undefined,
          },
        },
      },
    }),
  }),
};
