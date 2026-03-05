import { createUserId } from "@flex/testing";
import { type MiddlewareObj } from "@middy/core";
import {
  type APIGatewayProxyEventV2WithLambdaAuthorizer,
  Context,
} from "aws-lambda";
import { vi } from "vitest";

import { ContextWithUserId } from "..";
import { type V2Authorizer } from "..";

export const extractUser: MiddlewareObj<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  unknown,
  Error,
  ContextWithUserId
> = {
  before: vi.fn().mockImplementation((request) => {
    (request as ContextWithUserId).userId = createUserId("test-user-id");
  }),
};

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

export default {
  extractUser,
  createSecretsMiddleware,
};
