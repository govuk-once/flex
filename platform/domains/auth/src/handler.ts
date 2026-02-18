import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { JwtBaseError, NonRetryableFetchError } from "aws-jwt-verify/error";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEventV2,
} from "aws-lambda";
import createHttpError from "http-errors";

import { createAuthService } from "./services/auth-service";

function createPolicy(
  effect: "Allow" | "Deny",
  routeArn: string,
  context?: Record<string, string>,
): APIGatewayAuthorizerResult {
  return {
    principalId: "anonymous",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        { Action: "execute-api:Invoke", Effect: effect, Resource: routeArn },
      ],
    },
    context,
  };
}

/**
 * Lambda authorizer handler for API Gateway HTTP API
 */
const handler = createLambdaHandler<
  APIGatewayRequestAuthorizerEventV2,
  APIGatewayAuthorizerResult
>(
  async (
    event: APIGatewayRequestAuthorizerEventV2,
  ): Promise<APIGatewayAuthorizerResult> => {
    const logger = getLogger();
    const authService = await createAuthService();

    try {
      const pairwiseId = await authService.extractPairwiseId(event);
      logger.debug("Extracted pairwise ID from JWT", { pairwiseId });

      return createPolicy("Allow", "*", { pairwiseId });
    } catch (error) {
      switch (true) {
        case error instanceof NonRetryableFetchError:
          logger.error("JWKS endpoint is unavailable", {
            error: error.message,
          });
          throw new createHttpError.InternalServerError(
            "JWKS endpoint is unavailable",
          );
        case error instanceof JwtBaseError:
          logger.warn("JWT validation failed", { error: error.message });
          return createPolicy("Deny", event.routeArn);
        default:
          logger.error("Authorizer error", { error });
          throw error;
      }
    }
  },
  {
    serviceName: "auth-authorizer",
  },
);

export { handler };
