import { ApiResult, typedFetch } from "@flex/sdk";
import { createPublicFetch } from "@flex/service-gateway";

import { DVLA_REMOTE_ROUTES } from "../contract/route";
import { JwkSet } from "../schemas/remote/wellKnownJwk";
import { ConsumerConfig } from "../utils/getConsumerConfig";

let jwksCache: ApiResult<JwkSet> | null = null;

/**
 * Remote client for the DVLA API.
 *
 * Typed methods per DvlaRemoteContract. Validates responses with Zod schemas.
 * Private to the gateway package — domain services NEVER import from here.
 */
export function createDvlaRemoteClient(config: ConsumerConfig) {
  const fetcher = createPublicFetch({ baseUrl: config.apiUrl });

  const defaultHeaders = {
    Accept: "application/json",
  };

  return {
    authentication: {
      get: (): Promise<ApiResult<void>> => {
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.authenticate}/authenticate`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
            },
            body: JSON.stringify({
              userName: config.apiUsername,
              password: config.apiPassword,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    wellKnownJwk: {
      get: async (): Promise<ApiResult<JwkSet>> => {
        if (jwksCache && jwksCache.ok) return jwksCache;

        const requestBase = createPublicFetch({
          baseUrl: config.wellKnownJwkUrl,
        });
        const request = requestBase("/.well-known/jwks.json", {
          method: "GET",
        }).request;

        const result = await typedFetch<JwkSet>(request);

        if (result.ok) jwksCache = result;

        return result;
      },
    },
    customerVehicles: {
      get: (linkingId: string, jwt: string): Promise<ApiResult<void>> => {
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.app}/find-customer-vehicles`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
              Authorization: jwt.trim(),
            },
            body: JSON.stringify({
              linkingId,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    customerVehicle: {
      get: (
        linkingId: string,
        jwt: string,
        vehicleId: string,
      ): Promise<ApiResult<void>> => {
        console.log("wrong");
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.app}/retrieve-customer-vehicle-by-vehicle-id`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
              Authorization: jwt.trim(),
            },
            body: JSON.stringify({
              linkingId,
              vehicleId,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    customerDrivingLicence: {
      get: (linkingId: string, jwt: string): Promise<ApiResult<void>> => {
        console.log("seting up request to fetch driving-licence");
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.app}/retrieve-customer-driving-licence`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
              Authorization: jwt.trim(),
            },
            body: JSON.stringify({
              linkingId,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    notification: {
      post: (linkingId: string, jwt: string): Promise<ApiResult<void>> => {
        const request = fetcher(`${DVLA_REMOTE_ROUTES.app}/test-notification`, {
          method: "POST",
          headers: {
            ...defaultHeaders,
            "X-API-KEY": config.apiKey,
            Authorization: jwt.trim(),
          },
          body: JSON.stringify({
            linkingId: linkingId,
          }),
        }).request;
        return typedFetch(request);
      },
    },
    vehicle: {
      get: (registrationNumber: string, jwt: string): Promise<ApiResult<void>> => {
        console.log(`REG NUMBER SENDING TO DVLA: ${registrationNumber}`);
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.app}/retrieve-vehicle-by-vrn`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
              Authorization: jwt.trim(),
            },
            body: JSON.stringify({
              registrationNumber,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    cancelShareCode: {
      post: (
        linkingId: string,
        jwt: string,
        tokenId: string,
      ): Promise<ApiResult<void>> => {
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.app}/cancel-driving-licence-share-code`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
              Authorization: jwt.trim(),
            },
            body: JSON.stringify({
              linkingId,
              tokenId,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    shareCode: {
      post: (linkingId: string, jwt: string): Promise<ApiResult<void>> => {
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.app}/create-driving-licence-share-code`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
              Authorization: jwt.trim(),
            },
            body: JSON.stringify({
              linkingId,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    unlink: {
      post: (linkingId: string, jwt: string): Promise<ApiResult<void>> => {
        const request = fetcher(`${DVLA_REMOTE_ROUTES.app}/unlink-customer`, {
          method: "POST",
          headers: {
            ...defaultHeaders,
            "X-API-KEY": config.apiKey,
            Authorization: jwt.trim(),
          },
          body: JSON.stringify({
            linkingId,
          }),
        }).request;
        return typedFetch(request);
      },
    },
  };
}

export type DvlaRemoteClient = ReturnType<typeof createDvlaRemoteClient>;
