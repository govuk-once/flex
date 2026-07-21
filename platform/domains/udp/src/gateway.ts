import { createRestClient, mapApiResult } from "@flex/service-gateway";

import { createHandler } from "../gateway.config";
import { notificationsResponseSchema } from "./schemas/remote/notifications";

export const handler = createHandler({
  clients: ({ consumerConfig }) => ({
    api: createRestClient({
      baseUrl: consumerConfig.apiUrl,
      auth: {
        type: "sigv4",
        region: consumerConfig.region,
        roleArn: consumerConfig.consumerRoleArn,
        roleName: "consumer-session",
        externalId: consumerConfig.externalId,
      },
      headers: { "Content-Type": "application/json" },
    }),
  }),
  routes: {
    "GET /v1/identities/:id": ({
      clients: { api },
      resources: { consumerConfig },
      pathParams: { id },
    }) => {
      return api.get(`/v1/identity/app/${id}/linked-services`, {
        headers: { "x-api-key": consumerConfig.apiKey },
      });
    },
    "GET /v1/identity/:serviceName": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { userId },
      pathParams: { serviceName },
    }) => {
      return api.get("/v1/identity/exchange", {
        headers: {
          "x-api-key": consumerConfig.apiKey,
          "requesting-service": "app",
          "requesting-service-user-id": userId,
        },
        query: { requiredService: serviceName },
      });
    },
    "GET /v1/notifications": async ({
      clients: { api },
      resources: { consumerConfig },
      headers: { requestingServiceUserId },
    }) => {
      const result = await api.get("/v1/notifications", {
        schema: notificationsResponseSchema,
        headers: {
          "x-api-key": consumerConfig.apiKey,
          "requesting-service": "app",
          "requesting-service-user-id": requestingServiceUserId,
        },
      });

      return mapApiResult(result, ({ data }) => data);
    },
    "POST /v1/identity/:serviceName/:identifier": ({
      clients: { api },
      resources: { consumerConfig },
      body,
      pathParams: { serviceName, identifier },
    }) => {
      return api.post(`/v1/identity/${serviceName}/${identifier}`, {
        headers: { "x-api-key": consumerConfig.apiKey },
        body,
      });
    },
    "POST /v1/notifications": async ({
      clients: { api },
      resources: { consumerConfig },
      body,
      headers: { requestingServiceUserId },
    }) => {
      const result = await api.post("/v1/notifications", {
        schema: notificationsResponseSchema,
        headers: {
          "x-api-key": consumerConfig.apiKey,
          "requesting-service": "app",
          "requesting-service-user-id": requestingServiceUserId,
        },
        body: { data: body, requestingServiceUserId },
      });

      return mapApiResult(result, ({ data }) => data);
    },
    "POST /v1/users": ({
      clients: { api },
      resources: { consumerConfig },
      body,
    }) => {
      return api.post("/v1/user", {
        headers: { "x-api-key": consumerConfig.apiKey },
        body: { pushId: body.pushId, appId: body.userId },
      });
    },
    "DELETE /v1/identity/:serviceName/:identifier": ({
      clients: { api },
      resources: { consumerConfig },
      pathParams: { serviceName, identifier },
    }) => {
      return api.delete(`/v1/identity/${serviceName}/${identifier}`, {
        headers: { "x-api-key": consumerConfig.apiKey },
      });
    },
    "DELETE /v1/notifications": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { requestingServiceUserId },
    }) => {
      return api.delete("/v1/notifications", {
        headers: {
          "x-api-key": consumerConfig.apiKey,
          "requesting-service": "app",
          "requesting-service-user-id": requestingServiceUserId,
        },
      });
    },
  },
});
