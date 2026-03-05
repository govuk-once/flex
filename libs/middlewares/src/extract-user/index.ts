// Extracts the user from the request context
import { UserId } from "@flex/utils";
import { MiddlewareObj } from "@middy/core";
import type {
  APIGatewayProxyWithLambdaAuthorizerEvent,
  Context,
} from "aws-lambda";

export interface ContextWithUserId extends Context {
  userId: UserId;
}

export interface V2Authorizer {
  pairwiseId?: string;
}

export const extractUser: MiddlewareObj<
  APIGatewayProxyWithLambdaAuthorizerEvent<V2Authorizer>,
  unknown,
  Error,
  ContextWithUserId
> = {
  before: ({ event, context }) => {
    const { pairwiseId } = event.requestContext.authorizer;

    if (!pairwiseId) {
      throw new Error("Pairwise ID not found");
    }

    context.userId = pairwiseId as UserId;
  },
};
