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
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": consumerConfig.apiKey,
      },
    }),
  }),
  routes: {
    "GET /v1/groups": ({ clients: { api }, queryParams: { pushID } }) => {
      return api.get("/v1/groups", {
        query: { pushID },
      });
    },
    "POST /v1/groups": ({
      clients: { api },
      queryParams: { pushID },
      body,
    }) => {
      return api.post("/v1/groups", {
        query: { pushID },
        body,
      });
    },
    "GET /v1/notifications": ({
      clients: { api },
      queryParams: { externalUserID },
    }) => {
      return api.get("/notifications", { query: { externalUserID } });
    },
    "GET /v1/notifications/:id": ({
      clients: { api },
      pathParams: { id },
      queryParams: { externalUserID },
    }) => {
      return api.get(`/notifications/${id}`, { query: { externalUserID } });
    },
    "PATCH /v1/notifications/:id/status": ({
      clients: { api },
      pathParams: { id },
      queryParams: { externalUserID },
      body,
    }) => {
      return api.patch(`/notifications/${id}/status`, {
        query: { externalUserID },
        body,
      });
    },
    "DELETE /v1/notifications/:id": ({
      clients: { api },
      pathParams: { id },
      queryParams: { externalUserID },
    }) => {
      return api.delete(`/notifications/${id}`, { query: { externalUserID } });
    },
  },
});
