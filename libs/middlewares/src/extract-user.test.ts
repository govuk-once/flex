import { createMiddyRequest } from "@flex/testing";
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
    const request = createMiddyRequest<
      APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
      unknown,
      Error,
      ContextWithPairwiseId
    >({
      event: {
        requestContext: {
          authorizer: { lambda: { pairwiseId: "test-pairwise-id" } },
        },
      },
    });

    middleware.before!(request);

    expect(request.event.requestContext.authorizer.lambda.pairwiseId).toBe(
      "test-pairwise-id",
    );
  });

  it("throws an error if the pairwise id is not found", () => {
    const middleware = extractUser;
    const request = createMiddyRequest({
      event: {
        requestContext: {
          authorizer: { lambda: { pairwiseId: undefined } },
        },
      },
    });

    expect(() => middleware.before!(request)).toThrow("Pairwise ID not found");
  });
});
