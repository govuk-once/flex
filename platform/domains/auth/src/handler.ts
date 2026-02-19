import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import {
  FailedAssertionError,
  JwtBaseError,
  JwtExpiredError,
} from "aws-jwt-verify/error";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from "aws-lambda";

import { createPolicy } from "./createPolicy";
import { createAuthService } from "./services/auth-service";

/**
 * Lambda authorizer handler for API Gateway HTTP API
 */
const handler = createLambdaHandler<
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult
>(
  async (
    event: APIGatewayTokenAuthorizerEvent,
  ): Promise<APIGatewayAuthorizerResult> => {
    const logger = getLogger();
    const authService = await createAuthService();

    try {
      const pairwiseId = await authService.extractPairwiseId(event);
      logger.debug("Extracted pairwise ID from JWT", { pairwiseId });

      return createPolicy("Allow", "*", { pairwiseId });
    } catch (error) {
      logger.error("JWT verification failed", { error });

      switch (true) {
        case error instanceof JwtExpiredError:
          return createPolicy("Deny", event.methodArn, {
            errorMessage: "JWT expired",
          });
        case error instanceof FailedAssertionError:
          return createPolicy("Deny", event.methodArn);
        case error instanceof JwtBaseError:
          return createPolicy("Deny", event.methodArn);
        default:
          throw error;
      }
    }
  },
  {
    serviceName: "auth-authorizer",
  },
);

export { handler };
