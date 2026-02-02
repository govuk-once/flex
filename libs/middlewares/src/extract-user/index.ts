// Extracts the user from the request context
import { MiddlewareObj } from "@middy/core";
import type {
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  Context,
} from "aws-lambda";

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
      throw new Error("Pairwise ID not found");
    }

    context.pairwiseId = pairwiseId;
  },
};
