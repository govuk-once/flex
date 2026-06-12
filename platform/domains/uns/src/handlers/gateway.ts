import { createHandler } from "@gateway";

export const handler = createHandler({
  "DELETE /v1/notifications/:id": ({
    client,
    pathParams: { id },
    queryParams: { externalUserID },
  }) => {
    return client.request({
      method: "DELETE",
      path: `/notifications/${id}`,
      query: { externalUserID },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": client.config.apiKey,
      },
    });
  },
  "GET /v1/notifications/:id": ({
    client,
    pathParams: { id },
    queryParams: { externalUserID },
  }) => {
    return client.request({
      method: "GET",
      path: `/notifications/${id}`,
      query: { externalUserID },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": client.config.apiKey,
      },
    });
  },
  "GET /v1/notifications": ({ client, queryParams: { externalUserID } }) => {
    return client.request({
      method: "GET",
      path: "/notifications",
      query: { externalUserID },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": client.config.apiKey,
      },
    });
  },
  "PATCH /v1/notifications/:id/status": ({
    body,
    client,
    pathParams: { id },
    queryParams: { externalUserID },
  }) => {
    return client.request({
      method: "PATCH",
      path: `/notifications/${id}/status`,
      query: { externalUserID },
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": client.config.apiKey,
      },
      body,
    });
  },
});
