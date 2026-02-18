import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import {
  FailedAssertionError,
  JwtBaseError,
  JwtExpiredError,
  JwtNotBeforeError,
} from "aws-jwt-verify/error";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEventV2,
} from "aws-lambda";

import { createPolicy } from "./createPolicy";
import { createAuthService } from "./services/auth-service";

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

      return createPolicy("Allow", event.routeArn, { pairwiseId });
    } catch (error) {
      logger.error("JWT verification failed", { error });

      switch (true) {
        case error instanceof JwtExpiredError:
          return createPolicy("Deny", event.routeArn, {
            errorMessage: "JWT expired",
          });
        case error instanceof JwtNotBeforeError:
          return createPolicy("Deny", event.routeArn, {
            errorMessage: "JWT not yet valid",
          });
        case error instanceof FailedAssertionError:
          return createPolicy("Deny", event.routeArn, {
            errorMessage: error.message,
          });
        case error instanceof JwtBaseError:
          return createPolicy("Deny", event.routeArn);
        default:
          throw error;
      }
    }
  },
  {
    logLevel: "DEBUG",
    serviceName: "auth-authorizer",
  },
);

export { handler };
