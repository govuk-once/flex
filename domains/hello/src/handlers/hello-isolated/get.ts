import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
// import { createSignedFetcher } from "aws-sigv4-fetch";
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
    try {
      // const signedFetch = createSignedFetcher({
      //   service: "execute-api",
      //   region: "eu-west-2",
      // });

      // const response = await signedFetch(
      //   "https://${UDP-Private-API}.execute-api.eu-west-2.amazonaws.com/v1/hello",
      // );

      return Promise.resolve({
        statusCode: 200,
        body: JSON.stringify({ message: "Hello isolated world!" }),
      });
    } catch (_error: unknown) {
      return Promise.resolve({
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
      });
    }
  },
  {
    logLevel: "INFO",
    serviceName: "hello-service",
  },
);
