import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

/**
 * Target lambda behind the private API gateway.
 * Only reachable via the private API at /domains/hello/v1/hello-internal
 */
export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (_event) => {
    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify({ message: "Hello internal!" }),
    });
  },
  {
    logLevel: "INFO",
    serviceName: "hello-internal-service",
  },
);
