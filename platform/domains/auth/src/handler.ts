import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
} from "aws-lambda";

import { getLogger } from "@flex/logging";
import { getConfig } from "./config";
import { CognitoJwtVerifier } from "aws-jwt-verify";

/**
 * Lambda authorizer handler for API Gateway HTTP API
 *
 * Reads from and writes to ElastiCache Redis cluster for caching authorization data.
 */
const handler = createLambdaHandler<
  APIGatewayRequestAuthorizerEvent,
  APIGatewayAuthorizerResult
>(
  async (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
    const logger = getLogger();

    const jwt = event.headers?.authorization?.split(" ")[1];
    if (!jwt) {
      logger.error("No authorization token provided");
      throw new Error("No authorization token provided");
    }

    const config = await getConfig();

    const verifier = CognitoJwtVerifier.create({
      userPoolId: config.USERPOOL_ID,
      tokenUse: "access",
      clientId: config.CLIENT_ID,
    });

    try {
      await verifier.verify(jwt);
      logger.info("JWT verification successful");

    } catch (error) {
      logger.error("JWT verification failed", { error });
      throw new Error(`Invalid JWT: ${(error as Error).message}`);
    }

    return Promise.resolve({
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
    });
  },
  {
    serviceName: "auth-authorizer",
  },
);

export { handler };
