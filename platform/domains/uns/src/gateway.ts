import { createRestClient } from "@flex/service-gateway";

import { createHandler } from "../gateway.config";

export const handler = createHandler({
  clients: ({ consumerConfig }) => ({
    api: createRestClient({
      baseUrl: consumerConfig.privateApiUrl,
      auth: {
        type: "sigv4",
        region: consumerConfig.region,
        roleArn: consumerConfig.roleArn,
        roleName: "uns-consumer-session",
      },
      headers: { "Content-Type": "application/json" },
    }),
  }),
  routes: {
    "GET /v1/notifications": ({
      clients: { api },
      resources: { consumerConfig },
      queryParams: { externalUserID },
    }) => {
      return api.get("/notifications", {
        headers: { "X-API-KEY": consumerConfig.apiKey },
        query: { externalUserID },
      });
    },
    "GET /v1/notifications/:id": ({
      clients: { api },
      resources: { consumerConfig },
      pathParams: { id },
      queryParams: { externalUserID },
    }) => {
      return api.get(`/notifications/${id}`, {
        headers: { "X-API-KEY": consumerConfig.apiKey },
        query: { externalUserID },
      });
    },
    "PATCH /v1/notifications/:id/status": ({
      clients: { api },
      resources: { consumerConfig },
      pathParams: { id },
      queryParams: { externalUserID },
      body,
    }) => {
      return api.patch(`/notifications/${id}/status`, {
        headers: { "X-API-KEY": consumerConfig.apiKey },
        query: { externalUserID },
        body,
      });
    },
    "DELETE /v1/notifications/:id": ({
      clients: { api },
      resources: { consumerConfig },
      pathParams: { id },
      queryParams: { externalUserID },
    }) => {
      return api.delete(`/notifications/${id}`, {
        headers: { "X-API-KEY": consumerConfig.apiKey },
        query: { externalUserID },
      });
    },
  },
});
