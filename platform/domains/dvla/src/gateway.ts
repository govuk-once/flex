import { logger } from "@flex/logging";
import type { ApiResult } from "@flex/sdk";
import { createRestClient } from "@flex/service-gateway";
import { v4 as uuidV4 } from "uuid";

import { createHandler } from "../gateway.config";
import { JwkSetSchema } from "./schemas/domain/wellKnownJwk";
import type { JwkSet } from "./schemas/remote/wellKnownJwk";

let jwksCache: ApiResult<JwkSet> | undefined;

export const handler = createHandler({
  clients: ({ consumerConfig }) => {
    // TODO: Conditionally include the correlation ID header alongside the base headers in the REST client instead?
    const correlationId = uuidV4();

    logger.info("DVLA correlation ID", { correlationId });

    return {
      api: createRestClient({
        baseUrl: consumerConfig.apiUrl,
        auth: { type: "public" },
        headers: { "X-Correlation-Id": correlationId },
      }),
      jwks: createRestClient({
        baseUrl: consumerConfig.wellKnownJwkUrl,
        auth: { type: "public" },
        headers: { "Content-Type": "application/json" },
      }),
    };
  },
  routes: {
    "GET /v1/authenticate": ({
      clients: { api },
      resources: { consumerConfig },
    }) => {
      return api.post("/thirdparty-access/v1/authenticate", {
        body: {
          userName: consumerConfig.apiUsername,
          password: consumerConfig.apiPassword, // pragma: allowlist secret
        },
      });
    },
    "GET /v1/customer/licence": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      queryParams: { linkingId },
    }) => {
      return api.post(
        "/govuk-app-service/v1/retrieve-customer-driving-licence",
        {
          headers: { Authorization: auth, "X-API-KEY": consumerConfig.apiKey },
          body: { linkingId },
        },
      );
    },
    "GET /v1/customer/vehicles": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      queryParams: { linkingId },
    }) => {
      return api.post("/govuk-app-service/v1/find-customer-vehicles", {
        headers: { Authorization: auth, "X-API-KEY": consumerConfig.apiKey },
        body: { linkingId },
      });
    },
    "GET /v1/customer/vehicle/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
      queryParams: { linkingId },
    }) => {
      return api.post(
        "/govuk-app-service/v1/retrieve-customer-vehicle-by-vehicle-id",
        {
          headers: { Authorization: auth, "X-API-KEY": consumerConfig.apiKey },
          body: { linkingId, vehicleId: id },
        },
      );
    },
    "GET /v1/vehicle-enquiry/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
    }) => {
      return api.post("/govuk-app-service/v1/retrieve-vehicle-by-vrn", {
        headers: { Authorization: auth, "X-API-KEY": consumerConfig.apiKey },
        body: { registrationNumber: id },
      });
    },
    "GET /v1/well-known-jwks": async ({ clients: { jwks } }) => {
      if (jwksCache?.ok) return jwksCache;

      const result = await jwks.get("/.well-known/jwks.json", {
        schema: JwkSetSchema,
      });

      if (result.ok) jwksCache = result;

      return result;
    },
    "POST /v1/share-code": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      queryParams: { linkingId },
    }) => {
      return api.post(
        "/govuk-app-service/v1/create-driving-licence-share-code",
        {
          headers: { Authorization: auth, "X-API-KEY": consumerConfig.apiKey },
          body: { linkingId },
        },
      );
    },
    "POST /v1/share-code/:id/cancel": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
      queryParams: { linkingId },
    }) => {
      return api.post(
        "/govuk-app-service/v1/cancel-driving-licence-share-code",
        {
          headers: { Authorization: auth, "X-API-KEY": consumerConfig.apiKey },
          body: { linkingId, tokenId: id },
        },
      );
    },
    "POST /v1/test-notification/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
    }) => {
      return api.post("/govuk-app-service/v1/test-notification", {
        headers: { Authorization: auth, "X-API-KEY": consumerConfig.apiKey },
        body: { linkingId: id },
      });
    },
    "POST /v1/unlink-user/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
    }) => {
      return api.post("/govuk-app-service/v1/unlink-customer", {
        headers: { Authorization: auth, "X-API-KEY": consumerConfig.apiKey },
        body: { linkingId: id },
      });
    },
  },
});
