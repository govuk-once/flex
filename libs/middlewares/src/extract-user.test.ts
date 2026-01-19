import {
  apiGatewayRequestWithAuthorizer,
  authorizerEvent,
  context,
  createEvent,
  it,
} from "@flex/testing";
import { APIGatewayProxyEventV2WithLambdaAuthorizer } from "aws-lambda";
import { describe, expect } from "vitest";

import {
  ContextWithPairwiseId,
  extractUser,
  V2Authorizer,
} from "./extract-user";

describe("extractUser middleware", () => {
  it("extracts the user from the request context", () => {
    const middleware = extractUser;
    const request = {
      event: apiGatewayRequestWithAuthorizer,
      context,
      internal: {},
      response: null,
      error: null,
    };

    middleware.before!(request);

    expect(request.event.requestContext.authorizer.lambda.pairwiseId).toBe(
      "test-pairwise-id",
    );
  });

  it("throws an error if the pairwise id is not found", () => {
    const middleware = extractUser;
    const request = {
      event: apiGatewayRequestWithAuthorizer,
      context,
      internal: {},
      response: null,
      error: null,
    };

    expect(() => middleware.before!(request)).toThrow("Pairwise ID not found");
  });
});
