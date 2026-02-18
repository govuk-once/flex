import { ApiGatewayV2Envelope } from "@aws-lambda-powertools/parser/envelopes/api-gatewayv2";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import {
  ContextWithPairwiseId,
  extractUser,
  V2Authorizer,
} from "@flex/middlewares";
import { getConfig } from "@flex/params";
import { jsonResponse } from "@flex/utils";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import {
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import createHttpError from "http-errors";
import { z } from "zod";

import { CONSENT_STATUS_SCHEMA } from "../../../../schemas";
import { updateNotificationPreferences } from "../../services/updateNotificationPreferences";

const handlerRequestSchema = z
  .object({
    notificationsConsented: CONSENT_STATUS_SCHEMA,
  })
  .strict();

export const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

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
      logger.debug({ message });
      throw new createHttpError.BadRequest();
    }
    const config = await getConfig(configSchema);

    const response = await updateNotificationPreferences({
      privateGatewayUrl: config.FLEX_PRIVATE_GATEWAY_URL,
      awsRegion: config.AWS_REGION,
      pairwiseId,
      consentStatus: parsedEvent.data.notificationsConsented,
      updatedAt: new Date().toISOString(),
    });

    return jsonResponse(response.status, await response.json());
  },
  {
    serviceName: "udp-patch-user-service",
    middlewares: [extractUser, httpHeaderNormalizer(), httpJsonBodyParser()],
  },
);
