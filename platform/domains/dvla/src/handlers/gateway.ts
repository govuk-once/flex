import { createHandler } from "@gateway";
import { getJwks } from "@services/get-jwks";

export const handler = createHandler({
  "GET /v1/authenticate": ({ client }) => {
    return client.request({
      method: "POST",
      path: "/thirdparty-access/v1/authenticate",
      body: {
        userName: client.config.apiUsername,
        password: client.config.apiPassword, // pragma: allowlist secret
      },
    });
  },
  "GET /v1/licence/:id": ({ client, headers, pathParams: { id } }) => {
    return client.request({
      method: "POST",
      path: "/full-driver-enquiry/v1/driving-licences/retrieve",
      headers: {
        Authorization: headers.auth,
        "X-API-KEY": client.config.apiKey,
      },
      body: {
        drivingLicenceNumber: id,
        includeCPC: false,
        includeTacho: false,
        acceptPartialResponse: false,
      },
    });
  },
  "GET /v1/customer/:id": ({ client, headers, pathParams: { id } }) => {
    return client.request({
      method: "POST",
      path: "/govuk-app-service/v1/retrieve-customer-summary",
      headers: {
        Authorization: headers.auth,
        "X-API-KEY": client.config.apiKey,
      },
      body: { linkingId: id },
    });
  },
  "GET /v1/customer-summary/:id": ({ client, headers, pathParams: { id } }) => {
    return client.request({
      method: "POST",
      path: "/govuk-app-service/v1/retrieve-customer-summary",
      headers: {
        Authorization: headers.auth,
        "X-API-KEY": client.config.apiKey,
      },
      body: { linkingId: id },
    });
  },
  "GET /v1/driver-summary/:id": ({ client, headers, pathParams: { id } }) => {
    return client.request({
      method: "POST",
      path: "/govuk-app-service/v1/retrieve-driver-summary",
      headers: {
        Authorization: headers.auth,
        "X-API-KEY": client.config.apiKey,
      },
      body: { linkingId: id },
    });
  },
  "GET /v1/vehicle-enquiry/:id": ({ client, pathParams: { id } }) => {
    return client.request({
      method: "POST",
      path: "/vehicle-enquiry/v1/vehicles",
      headers: {
        "X-API-KEY": client.config.apiPublicKey,
      },
      body: { registrationNumber: id },
    });
  },
  "GET /v1/share-codes": ({ client, headers, queryParams: { linkingId } }) => {
    return client.request({
      method: "POST",
      path: "/govuk-app-service/v1/list-driving-licence-share-codes",
      headers: {
        Authorization: headers.auth,
        "X-API-KEY": client.config.apiKey,
      },
      body: { linkingId },
    });
  },
  "GET /v1/well-known-jwks": ({ client }) => {
    return getJwks(client.config.wellKnownJwkUrl);
  },
  "POST /v1/share-code": ({ client, headers, queryParams: { linkingId } }) => {
    return client.request({
      method: "POST",
      path: "/govuk-app-service/v1/create-driving-licence-share-code",
      headers: {
        Authorization: headers.auth,
        "X-API-KEY": client.config.apiKey,
      },
      body: { linkingId },
    });
  },
  "POST /v1/share-code/:id/cancel": ({
    client,
    headers,
    pathParams: { id },
    queryParams: { linkingId },
  }) => {
    return client.request({
      method: "POST",
      path: "/govuk-app-service/v1/cancel-driving-licence-share-code",
      headers: {
        Authorization: headers.auth,
        "X-API-KEY": client.config.apiKey,
      },
      body: { linkingId, tokenId: id },
    });
  },
  "POST /v1/test-notification/:id": ({
    client,
    headers,
    pathParams: { id },
  }) => {
    return client.request({
      method: "POST",
      path: "/govuk-app-service/v1/test-notification",
      headers: {
        Authorization: headers.auth,
        "X-API-KEY": client.config.apiKey,
      },
      body: { linkingId: id },
    });
  },
  "POST /v1/unlink-user/:id": ({ client, headers, pathParams: { id } }) => {
    return client.request({
      method: "POST",
      path: "/govuk-app-service/v1/unlink-customer",
      headers: {
        Authorization: headers.auth,
        "X-API-KEY": client.config.apiKey,
      },
      body: { linkingId: id },
    });
  },
});
