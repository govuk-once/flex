import { injectLambdaContext, logger } from "@flex/logging";
import { clearTmp } from "@flex/sdk";
import middy, { MiddyfiedHandler } from "@middy/core";
import { JwtExpiredError } from "aws-jwt-verify/error";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
  Context,
} from "aws-lambda";

import { createPolicy } from "./createPolicy";
import { createAuthService } from "./services/auth-service";

/**
 * Lambda authorizer handler for API Gateway HTTP API
 */
const handler: MiddyfiedHandler<
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
  Error,
  Context
> = middy<APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult>()
  .use(
    injectLambdaContext(logger, {
      clearState: true,
      correlationIdPath: "requestContext.requestId",
    }),
  )
  .handler(
    async (
      event: APIGatewayTokenAuthorizerEvent,
    ): Promise<APIGatewayAuthorizerResult> => {
      logger.setServiceName("auth-authorizer");
      logger.setLogLevel("INFO");

      try {
        const authService = await createAuthService();
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
          default:
            return createPolicy("Deny", event.methodArn);
        }
      } finally {
        clearTmp();
      }
    },
  );

export { handler };
