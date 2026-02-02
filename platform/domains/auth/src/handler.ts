import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEventV2,
} from "aws-lambda";
import createHttpError from "http-errors";
import z from "zod";

export const configSchema = z.looseObject({
  AWS_REGION: z.string().min(1),
  USERPOOL_ID_PARAM_NAME: z.string().min(1),
  CLIENT_ID_PARAM_NAME: z.string().min(1),
});

/**
 * Lambda authorizer handler for API Gateway HTTP API
 *
 * Reads from and writes to ElastiCache Redis cluster for caching authorization data.
 */
const handler = createLambdaHandler<
  APIGatewayRequestAuthorizerEventV2,
  APIGatewayAuthorizerResult
>(
  async (
    event: APIGatewayRequestAuthorizerEventV2,
  ): Promise<APIGatewayAuthorizerResult> => {
    const logger = getLogger();

    const jwt = event.headers?.authorization?.split(" ")[1];
    if (!jwt) {
      const message = "No authorization token provided";
      logger.error(message);
      throw new createHttpError.Unauthorized(message);
    }

    const config = await getConfig(configSchema);

    const verifier = CognitoJwtVerifier.create({
      userPoolId: config.USERPOOL_ID,
      tokenUse: "access",
      clientId: config.CLIENT_ID,
    });

    try {
      const decodedJwt = await verifier.verify(jwt);
      logger.info("JWT verification successful");

      const pairwiseId = decodedJwt.username;
      if (!pairwiseId) {
        const message = "Pairwise ID (username) not found in JWT";
        logger.error(message);
        throw new createHttpError.Unauthorized(message);
      }
      logger.debug("Extracted pairwise ID from JWT", { pairwiseId });

      return await Promise.resolve({
        principalId: "anonymous",
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Action: "execute-api:Invoke",
              Effect: "Allow",
              Resource: "*",
            },
          ],
        },
        context: {
          pairwiseId,
        },
      });
    } catch (error) {
      logger.error("JWT verification failed", { error });
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
