import { createHandler } from "@gateway";

export const handler = createHandler({
  "DELETE /v1/identity/:serviceName/:identifier": ({
    client,
    pathParams: { serviceName, identifier },
  }) => {
    return client.request({
      method: "DELETE",
      path: `/v1/identity/${serviceName}/${identifier}`,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": client.config.apiKey,
      },
    });
  },
  "DELETE /v1/notifications": ({
    client,
    headers: { requestingServiceUserId },
  }) => {
    return client.request({
      method: "DELETE",
      path: "/v1/notifications",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": client.config.apiKey,
        "requesting-service": "app",
        "requesting-service-user-id": requestingServiceUserId,
      },
    });
  },
  "GET /v1/identities/:id": ({ client, pathParams: { id } }) => {
    return client.request({
      method: "GET",
      path: "/v1/identities",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": client.config.apiKey,
        "requesting-service": "app",
        "requesting-service-user-id": id,
      },
    });
  },
  "GET /v1/identity/:serviceName": ({
    client,
    headers: { userId },
    pathParams: { serviceName },
  }) => {
    return client.request({
      method: "GET",
      path: "/v1/identity/exchange",
      query: { requiredService: serviceName },
      headers: {
        "Content-Type": "application/json",
        "x-api-key": client.config.apiKey,
        "requesting-service": "app",
        "requesting-service-user-id": userId,
      },
    });
  },
  "GET /v1/notifications": async ({
    client,
    headers: { requestingServiceUserId },
  }) => {
    const response = await client.request({
      method: "GET",
      path: "/v1/notifications",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": client.config.apiKey,
        "requesting-service": "app",
        "requesting-service-user-id": requestingServiceUserId,
      },
    });

    return {
      ...response,
      body: response.data,
    };
  },
  "POST /v1/identities/:id": ({ client, body, pathParams: { id } }) => {
    return client.request({
      method: "POST",
      path: "/v1/identities",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": client.config.apiKey,
        "requesting-service": "app",
        "requesting-service-user-id": id,
      },
      body,
    });
  },
  "POST /v1/identity/:serviceName/:identifier": ({
    client,
    body,
    pathParams: { serviceName, identifier },
  }) => {
    return client.request({
      method: "POST",
      path: `/v1/identity/${serviceName}/${identifier}`,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": client.config.apiKey,
      },
      body,
    });
  },
  "POST /v1/notifications": async ({
    client,
    body,
    headers: { requestingServiceUserId },
  }) => {
    const response = await client.request({
      method: "POST",
      path: "/v1/notifications",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": client.config.apiKey,
        "requesting-service": "app",
        "requesting-service-user-id": requestingServiceUserId,
      },
      body,
    });

    return {
      ...response,
      body: response.data,
    };
  },
  "POST /v1/users": ({ client, body }) => {
    return client.request({
      method: "POST",
      path: "/v1/user",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": client.config.apiKey,
      },
      body: {
        pushId: body.pushId,
        appId: body.userId,
      },
    });
  },
});
