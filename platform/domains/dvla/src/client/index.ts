import { ApiResult, typedFetch } from "@flex/flex-fetch";
import { createPublicFetch } from "@flex/sdk-service-gw";

import { DVLA_REMOTE_ROUTES } from "../contract/route";
import { ConsumerConfig } from "../schemas/config";

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
        const request = fetcher(`${DVLA_REMOTE_ROUTES.app}/retrieve-customer`, {
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
  };
}

export type DvlaRemoteClient = ReturnType<typeof createDvlaRemoteClient>;
