import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEventV2,
} from "aws-lambda";
import createHttpError from "http-errors";

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

      return {
        principalId: "anonymous",
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            { Action: "execute-api:Invoke", Effect: "Allow", Resource: "*" },
          ],
        },
        context: { pairwiseId },
      };
    } catch (error) {
      logger.error("JWT verification failed", { error });

      if (createHttpError.isHttpError(error)) throw error;

      throw new createHttpError.Unauthorized(
        `Invalid JWT: ${(error as Error).message}`,
      );
    }
  },
  {
    serviceName: "auth-authorizer",
  },
);

export { handler };
