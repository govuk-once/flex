import {
  ApiResult,
  flexFetch,
  FlexFetchRequestInit,
  typedFetch,
} from "@flex/flex-fetch";

import { DVLA_REMOTE_ROUTES } from "../contract/route";
import { ConsumerConfig } from "../utils/getConsumerConfig";

/**
 * TODO will add this into flex-fetch package
 */
function createPublicFetch(config: { baseUrl: string; apiKey: string }) {
  return (url: string, options?: FlexFetchRequestInit) => {
    const fullUrl = url.startsWith("http") ? url : `${config.baseUrl}${url}`;

    const headers = {
      "Content-Type": "application/json",
      "X-API-KEY": config.apiKey,
    };

    return flexFetch(fullUrl, {
      ...options,
      headers,
      retryAttempts: options?.retryAttempts ?? 3,
    });
  };
}

/**
 * Remote client for the DVLA API.
 *
 * Typed methods per UdpRemoteContract. Validates responses with Zod schemas.
 * Private to the gateway package — domain services NEVER import from here.
 */
export function createDvlaRemoteClient(config: ConsumerConfig) {
  const fetcher = createPublicFetch({
    baseUrl: config.apiUrl,
    apiKey: config.apiKey,
  });

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
              // Removing X-API-KEY which is set as a default header as not needed for this endpoint
              "X-API-KEY": "",
            },
            body: JSON.stringify({
              username: config.apiUsername,
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
          `${DVLA_REMOTE_ROUTES.linking}/retrieve-customer`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              Authorization: jwt,
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
          `${DVLA_REMOTE_ROUTES.licence}/driving-licences/retrieve`,
          {
            method: "POST",
            headers: {
              ...defaultHeaders,
              Authorization: jwt,
            },
            body: JSON.stringify({
              linkingId: id,
            }),
          },
        ).request;
        return typedFetch(request);
      },
    },
  };
}

export type DvlaRemoteClient = ReturnType<typeof createDvlaRemoteClient>;
