import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";

export const handlerResponseSchema = z.object({
  message: z.string(),
});
export type HandlerResponse = z.output<typeof handlerResponseSchema>;

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2<HandlerResponse>
>(
  async (_event) => {
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
