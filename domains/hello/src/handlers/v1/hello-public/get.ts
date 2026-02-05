import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (_event) => {
    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify({ message: "Hello public world!" }),
    });
  },
  {
    logLevel: "INFO",
    serviceName: "hello-service",
  },
);
