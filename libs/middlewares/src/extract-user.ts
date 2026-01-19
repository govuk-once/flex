// Extracts the user from the request context
import { MiddlewareObj } from "@middy/core";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";

// 1. Extend the Context interface so TS knows 'pairwiseId' is allowed
export interface ContextWithPairwiseId extends Context {
  pairwiseId?: string;
}

// 2. Define the expected shape of your Authorizer
// For APIGatewayProxyEventV2 (HTTP API), custom data is nested in the 'lambda' property.
interface V2Authorizer {
  lambda: {
    pairwiseId?: string;
  };
}

export const extractUser: MiddlewareObj<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2<unknown>,
  Error,
  ContextWithPairwiseId
> = {
  before: (request) => {
    const authorizer =
      // @ts-expect-error: lambda proxy event type is not compatible with the authorizer type
      request.event.requestContext.authorizer as unknown as V2Authorizer;
    const pairwiseId = authorizer?.lambda?.pairwiseId;

    if (!pairwiseId) {
      throw new Error("Pairwise ID not found");
    }

    request.context.pairwiseId = pairwiseId;
  },
};
