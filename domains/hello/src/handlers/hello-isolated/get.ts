import { createLambdaHandler } from "@flex/handlers";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export const handler = createLambdaHandler(
  async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify({ message: "Hello isolated world!" }),
    });
  },
  {
    logLevel: "INFO",
    serviceName: "hello-service",
  },
);
