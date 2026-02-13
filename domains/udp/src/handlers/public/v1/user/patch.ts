import { ApiGatewayV2Envelope } from "@aws-lambda-powertools/parser/envelopes/api-gatewayv2";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import {
  ContextWithPairwiseId,
  extractUser,
  V2Authorizer,
} from "@flex/middlewares";
import { getConfig } from "@flex/params";
import { jsonResponse, sigv4Fetch } from "@flex/utils";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import {
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import createHttpError from "http-errors";
import { z } from "zod";

const handlerRequestSchema = z
  .object({
    notificationsConsented: z.boolean().optional(),
    analyticsConsented: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => {
      return (
        Object.values(data).filter((v) => typeof v === "boolean").length >= 1
      );
    },
    {
      message: "At least one field must be provided",
    },
  );

export const handlerResponseSchema = z.object({
  preferences: z.object({
    notificationsConsented: z.boolean().optional(),
    analyticsConsented: z.boolean().optional(),
    updatedAt: z.string(),
  }),
});

export const configSchema = z.looseObject({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

const SERVICE_NAME = "app";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2WithLambdaAuthorizer<V2Authorizer>,
  APIGatewayProxyResultV2,
  ContextWithPairwiseId
>(
  async (event, context) => {
    const logger = getLogger();
    const { pairwiseId } = context;
    const parsedEvent = ApiGatewayV2Envelope.safeParse(
      event,
      handlerRequestSchema,
    );

    if (!parsedEvent.success) {
      const message = `Invalid parsed event: ${parsedEvent.error.message}`;
      throw new createHttpError.BadRequest(message);
    }
    const config = await getConfig(configSchema);
    const baseUrl = new URL(config.FLEX_PRIVATE_GATEWAY_URL);

    const response = await sigv4Fetch({
      region: config.AWS_REGION,
      path: `${baseUrl.pathname}/gateways/udp/v1/notifications`,
      method: "POST",
      baseUrl: baseUrl.toString(),
      body: parsedEvent,
      headers: {
        "requesting-service": SERVICE_NAME,
        "requesting-service-user-id": pairwiseId,
      },
    });

    const responseBody = await response.json();
    logger.info("Notification response", {
      body: responseBody,
      status: response.status,
    });

    return Promise.resolve(jsonResponse(response.status, responseBody));
  },
  {
    logLevel: "INFO",
    serviceName: "udp-patch-user-service",
    middlewares: [extractUser, httpHeaderNormalizer(), httpJsonBodyParser()],
  },
);
