import { injectLambdaContext, logger } from "@flex/logging";
import { clearTmp } from "@flex/sdk";
import { emitTelemetry, TelemetryEvent } from "@flex/telemetry";
import middy, { MiddyfiedHandler } from "@middy/core";
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
 * JwtExpiredError and the other claim errors subclass FailedAssertionError,
 * so the checks run from most to least specific. The bare
 * FailedAssertionError cases are the two assertions thrown by the auth
 * service itself, distinguished by their expected values.
 */
function toAuthTelemetryEvent(error: unknown): TelemetryEvent {
  if (error instanceof JwtExpiredError) {
    return TelemetryEvent.auth_token_expired;
  }

  if (error instanceof FailedAssertionError) {
    if (error.failedAssertion.expected === "authorization token") {
      return TelemetryEvent.auth_token_missing;
    }
    if (error.failedAssertion.expected === "username") {
      return TelemetryEvent.auth_claim_missing;
    }
  }

  if (error instanceof JwtBaseError) {
    return TelemetryEvent.auth_token_invalid;
  }

  return TelemetryEvent.auth_failure;
}

/**
 * Lambda authorizer handler for API Gateway HTTP API
 */
const handler: MiddyfiedHandler<
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult
> = middy<APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult>()
  .use(
    injectLambdaContext(logger, {
      clearState: true,
      correlationIdPath: 'headers."x-correlation-id"',
    }),
  )
  .handler(
    async (
      event: APIGatewayTokenAuthorizerEvent,
    ): Promise<APIGatewayAuthorizerResult> => {
      logger.setServiceName("auth-authorizer");
      logger.setLogLevel("INFO");

      try {
        const pairwiseId = await createAuthService().extractPairwiseId(event);
        logger.debug("Extracted pairwise ID from JWT", { pairwiseId });

        emitTelemetry(TelemetryEvent.auth_success, { pairwiseId });

        return createPolicy("Allow", "*", { pairwiseId });
      } catch (error) {
        logger.error("JWT verification failed", { error });

        emitTelemetry(toAuthTelemetryEvent(error), {
          ...(error instanceof Error && { reason: error.message }),
        });

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
