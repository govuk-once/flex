import { createEvent, createMiddyRequest } from "@flex/testing";
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from "aws-lambda";
import { describe, expect, it } from "vitest";

import {
  ContextWithPairwiseId,
  extractUser,
  V2Authorizer,
} from "./extract-user";

describe("extractUser middleware", () => {
  it("extracts the user from the request context", () => {
    const middleware = extractUser;
    const eventWithAuthorizer: APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer> =
      {
        ...createEvent().create(),
        requestContext: {
          ...createEvent().create().requestContext,
          authorizer: { lambda: { pairwiseId: "test-pairwise-id" } },
        },
      };

    const request = createMiddyRequest<
      APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
      unknown,
      Error,
      ContextWithPairwiseId
    >({
      event: eventWithAuthorizer,
      context: {} as ContextWithPairwiseId,
    });

    middleware.before!(request);

    expect(request.event.requestContext.authorizer.lambda.pairwiseId).toBe(
      "test-pairwise-id",
    );
  });

  it("throws an error if the pairwise id is not found", () => {
    const middleware = extractUser;
    const baseEvent = createEvent().create();
    const eventWithAuthorizer: APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer> =
      {
        ...baseEvent,
        requestContext: {
          ...baseEvent.requestContext,
          authorizer: { lambda: { pairwiseId: undefined } },
        },
      };

    const request = createMiddyRequest<
      APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
      unknown,
      Error,
      ContextWithPairwiseId
    >({
      event: eventWithAuthorizer,
    });

    expect(() => middleware.before!(request)).toThrow("Pairwise ID not found");
  });
});
