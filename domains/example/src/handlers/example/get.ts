import { createLambdaHandler } from "@flex/handlers";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

/**
 * Lambda handler for GET /example
 * Get hello world from lambda
 */
const handler = createLambdaHandler(
  async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify({ message: "Hello, World!" }),
    });
  },
  {
    logLevel: "INFO",
    serviceName: "example-service",
  },
);

export { handler };
