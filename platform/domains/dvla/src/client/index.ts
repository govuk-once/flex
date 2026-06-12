import { ApiResult, typedFetch } from "@flex/flex-fetch";

import { DVLA_REMOTE_ROUTES } from "../contract/route";
import { JwkSet } from "../schemas/remote/wellKnownJwk";
import { createPublicFetch } from "../utils/createPublicFetch";
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
    licence: {
      get: (id: string, jwt: string): Promise<ApiResult<void>> => {
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.licence}/driving-licences/retrieve`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
              Authorization: jwt.trim(),
            },
            body: JSON.stringify({
              drivingLicenceNumber: id,
              includeCPC: false,
              includeTacho: false,
              acceptPartialResponse: false,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    customer: {
      get: (id: string, jwt: string): Promise<ApiResult<void>> => {
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.app}/retrieve-customer-summary`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
              Authorization: jwt.trim(),
            },
            body: JSON.stringify({
              linkingId: id,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    notification: {
      post: (id: string, jwt: string): Promise<ApiResult<void>> => {
        const request = fetcher(`${DVLA_REMOTE_ROUTES.app}/test-notification`, {
          method: "POST",
          headers: {
            ...defaultHeaders,
            "X-API-KEY": config.apiKey,
            Authorization: jwt.trim(),
          },
          body: JSON.stringify({
            linkingId: id,
          }),
        }).request;
        return typedFetch(request);
      },
    },
    driver: {
      get: (id: string, jwt: string): Promise<ApiResult<void>> => {
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.app}/retrieve-driver-summary`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
              Authorization: jwt.trim(),
            },
            body: JSON.stringify({
              linkingId: id,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    vehicle: {
      get: (reg: string): Promise<ApiResult<void>> => {
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.vehicleEnquiry}/vehicles`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiPublicKey,
            },
            body: JSON.stringify({
              registrationNumber: reg,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
    shareCodes: {
      get: (linkingId: string, jwt: string): Promise<ApiResult<void>> => {
        const request = fetcher(
          `${DVLA_REMOTE_ROUTES.app}/list-driving-licence-share-codes`,
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
