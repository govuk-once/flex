import { ApiGatewayV2Envelope } from "@aws-lambda-powertools/parser/envelopes/api-gatewayv2";
import { createLambdaHandler } from "@flex/handlers";
import { extractUser } from "@flex/middlewares";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import httpResponseSerializer from "@middy/http-response-serializer";
import { z } from "zod";

export const handlerRequestSchema = z
  .object({
    notifications_consented: z.boolean(),
  })
  .strict();

export type HandlerRequest = z.input<typeof handlerRequestSchema>;

export const handlerResponseSchema = z.object({
  preferences: z.object({
    notifications_consented: z.boolean(),
    updated_at: z.string(),
  }),
});

export type HandlerResponse = z.output<typeof handlerResponseSchema>;

export const handler = createLambdaHandler(
  async (event) => {
    const parsedEvent = ApiGatewayV2Envelope.parse(event, handlerRequestSchema);

    return Promise.resolve({
      statusCode: 200,
      body: {
        preferences: {
          notifications_consented: parsedEvent.notifications_consented,
          updated_at: new Date().toISOString(),
        },
      },
    });
  },
  {
    logLevel: "INFO",
    serviceName: "udp-patch-user-service",
    middlewares: [
      extractUser,
      httpHeaderNormalizer(),
      httpJsonBodyParser(),
      httpResponseSerializer({
        defaultContentType: "application/json",
        serializers: [
          {
            regex: /^application\/json(?:;.*)?$/,
            serializer: ({ body }) => JSON.stringify(body),
          },
        ],
      }),
    ],
  },
);
