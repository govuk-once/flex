import { type MiddlewareObj } from "@middy/core";
import { type APIGatewayProxyEventV2WithLambdaAuthorizer } from "aws-lambda";
import { vi } from "vitest";

import { ContextWithPairwiseId } from "..";
import { type V2Authorizer } from "..";

// Assume the real module exports a function 'getUser'
export const extractUser: MiddlewareObj<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  unknown,
  Error,
  ContextWithPairwiseId
> = {
  before: vi.fn().mockImplementation((request) => {
    (request as ContextWithPairwiseId).pairwiseId = "test-pairwise-id";
  }),
};

// --- Mocking default export if you have one ---
export default {
  extractUser,
};
