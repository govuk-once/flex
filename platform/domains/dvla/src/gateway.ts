import { createRestClient } from "@flex/service-gateway";

import { createHandler } from "../gateway.config";

// TODO: verify route context/schemas/request-responsetransforms against existing SG
export const handler = createHandler({
  clients: ({ consumerConfig }) => ({
    api: createRestClient({
      baseUrl: consumerConfig.apiUrl,
      auth: { type: "public" },
    }),
    jwks: createRestClient({
      baseUrl: consumerConfig.wellKnownJwkUrl,
      auth: { type: "public" },
    }),
  }),
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
    "GET /v1/licence/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
    }) => {
      return api.post("/full-driver-enquiry/v1/driving-licences/retrieve", {
        headers: {
          Authorization: auth,
          "X-API-KEY": consumerConfig.apiKey,
        },
        body: {
          drivingLicenceNumber: id,
          includeCPC: false,
          includeTacho: false,
          acceptPartialResponse: false,
        },
      });
    },
    "GET /v1/customer/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
    }) => {
      return api.post("/govuk-app-service/v1/retrieve-customer-summary", {
        headers: {
          Authorization: auth,
          "X-API-KEY": consumerConfig.apiKey,
        },
        body: {
          linkingId: id,
        },
      });
    },
    "GET /v1/customer-summary/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
    }) => {
      return api.post("/govuk-app-service/v1/retrieve-customer-summary", {
        headers: {
          Authorization: auth,
          "X-API-KEY": consumerConfig.apiKey,
        },
        body: {
          linkingId: id,
        },
      });
    },
    "GET /v1/driver-summary/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
    }) => {
      return api.post("/govuk-app-service/v1/retrieve-driver-summary", {
        headers: {
          Authorization: auth,
          "X-API-KEY": consumerConfig.apiKey,
        },
        body: {
          linkingId: id,
        },
      });
    },
    "GET /v1/vehicle-enquiry/:id": ({
      clients: { api },
      resources: { consumerConfig },
      pathParams: { id },
    }) => {
      return api.post("/vehicle-enquiry/v1/vehicles", {
        headers: {
          "X-API-KEY": consumerConfig.apiPublicKey,
        },
        body: {
          registrationNumber: id,
        },
      });
    },
    "GET /v1/share-codes": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      queryParams: { linkingId },
    }) => {
      return api.post(
        "/govuk-app-service/v1/list-driving-licence-share-codes",
        {
          headers: {
            Authorization: auth,
            "X-API-KEY": consumerConfig.apiKey,
          },
          body: {
            linkingId,
          },
        },
      );
    },
    "GET /v1/well-known-jwks": ({ clients: { jwks } }) => {
      return jwks.get("/.well-known/jwks.json");
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
          headers: {
            Authorization: auth,
            "X-API-KEY": consumerConfig.apiKey,
          },
          body: {
            linkingId,
          },
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
          headers: {
            Authorization: auth,
            "X-API-KEY": consumerConfig.apiKey,
          },
          body: {
            linkingId,
            tokenId: id,
          },
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
        headers: {
          Authorization: auth,
          "X-API-KEY": consumerConfig.apiKey,
        },
        body: {
          linkingId: id,
        },
      });
    },
    "POST /v1/unlink-user/:id": ({
      clients: { api },
      resources: { consumerConfig },
      headers: { auth },
      pathParams: { id },
    }) => {
      return api.post("/govuk-app-service/v1/unlink-customer", {
        headers: {
          Authorization: auth,
          "X-API-KEY": consumerConfig.apiKey,
        },
        body: {
          linkingId: id,
        },
      });
    },
  },
});
