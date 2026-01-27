import { type MiddlewareObj } from "@middy/core";
import {
  type APIGatewayProxyEventV2WithLambdaAuthorizer,
  Context,
} from "aws-lambda";
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

// --- Mocking secrets exports ---
export const createSecretsMiddleware: MiddlewareObj<
  unknown,
  unknown,
  Error,
  Context & Record<string, string | undefined>
> = vi.fn().mockReturnValue({
  before: vi.fn(),
}) as unknown as MiddlewareObj<
  unknown,
  unknown,
  Error,
  Context & Record<string, string | undefined>
>;

// --- Mocking default export if you have one ---
export default {
  extractUser,
  createSecretsMiddleware,
};
