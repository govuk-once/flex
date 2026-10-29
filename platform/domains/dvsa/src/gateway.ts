import { clearCaches } from "@aws-lambda-powertools/parameters";
import { logger } from "@flex/logging";
import type { ApiResult } from "@flex/sdk";
import { flexFetch, typedFetch } from "@flex/sdk";
import { createRestClient, type GatewayLambda } from "@flex/service-gateway";

import { createHandler } from "../gateway.config";
import { authenticateResponseSchema } from "./schemas/domain/authenticate";
import type { AuthenticateResponseSchema } from "./schemas/remote/authenticate";

let authCache:
  | { result: ApiResult<AuthenticateResponseSchema>; expiresAt: number }
  | undefined;

const baseHandler = createHandler({
  clients: ({ consumerConfig }) => ({
    mot: createRestClient({
      baseUrl: consumerConfig.apiMotUrl,
      auth: { type: "public" },
    }),
  }),
  routes: {
    "GET /v1/authenticate": async ({ resources: { consumerConfig } }) => {
      const now = Math.floor(Date.now() / 1000);
      if (authCache?.result.ok && authCache.expiresAt > now + 60) {
        return authCache.result;
      }

      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: consumerConfig.clientId,
        client_secret: consumerConfig.clientSecret,
        scope: "https://tapi.dvsa.gov.uk/.default",
      });

      const { request } = flexFetch(consumerConfig.apiAuthUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        retryAttempts: 3,
      });

      const result = await typedFetch(request, authenticateResponseSchema);

      if (result.ok) {
        authCache = {
          result,
          expiresAt: now + result.data.expires_in,
        };
      }

      return result;
    },
    "GET /v1/vehicle/mot/:id": ({
      clients: { mot },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
    }) => {
      return mot.get(`/v1/trade/vehicles/registration/${id}`, {
        headers: {
          Authorization: `Bearer ${auth}`,
          "X-API-Key": consumerConfig.apiKey,
        },
      });
    },
  },
});

export const handler: GatewayLambda = async (event, context) => {
  const result = await baseHandler(event, context);

  if (
    typeof result === "object" &&
    (result.statusCode === 401 || result.statusCode === 403)
  ) {
    const isGatewayAuthRoute = event.path.endsWith("/v1/authenticate");

    logger.info(
      isGatewayAuthRoute
        ? "Gateway auth failure, clearing caches and retrying"
        : "Caller auth failure, clearing secret cache and retrying",
      { statusCode: result.statusCode, path: event.path },
    );

    clearCaches();
    if (isGatewayAuthRoute) {
      authCache = undefined;
    }

    return baseHandler(event, context);
  }

  return result;
};
