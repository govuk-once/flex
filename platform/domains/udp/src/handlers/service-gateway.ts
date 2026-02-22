import { createLambdaHandler } from "@flex/handlers";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = createLambdaHandler<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
>(
  async (_event) => {
    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify({ message: "hello" }),
    });
  },
  {
    logLevel: "INFO",
    serviceName: "udp-service-gateway",
  },
);
