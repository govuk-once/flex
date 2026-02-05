// Extracts the user from the request context
import { MiddlewareObj } from "@middy/core";
import type {
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  Context,
} from "aws-lambda";
import createHttpError from "http-errors";

export interface ContextWithPairwiseId extends Context {
  pairwiseId: string;
}

export interface V2Authorizer {
  pairwiseId?: string;
}

export const extractUser: MiddlewareObj<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  unknown,
  Error,
  ContextWithPairwiseId
> = {
  before: ({ event, context }) => {
    const { pairwiseId } = event.requestContext.authorizer.lambda;

    if (!pairwiseId) {
      throw new createHttpError.Unauthorized("Pairwise ID not found");
    }

    context.pairwiseId = pairwiseId;
  },
};
