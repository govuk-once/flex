import { ApiResult, typedFetch } from "@flex/flex-fetch";

import { UNS_REMOTE_ROUTES } from "../contract/route";
import { NotificationPatchBody } from "../schemas/remote/notification";
import { createPublicFetch } from "../utils/createPublicFetch";
import { ConsumerConfig } from "../utils/getConsumerConfig";

/**
 * Remote client for the UNS API.
 *
 * Typed methods per UnsRemoteContract. Validates responses with Zod schemas.
 * Private to the gateway package — domain services NEVER import from here.
 */
export function createUnsRemoteClient(config: ConsumerConfig) {
  const fetcher = createPublicFetch({ baseUrl: config.apiUrl });

  const defaultHeaders = {
    Accept: "application/json",
  };

  return {
    notification: {
      get: (
        pushId: string,
        notificationId: string,
      ): Promise<ApiResult<void>> => {
        const params = new URLSearchParams({ externalUserID: pushId });
        const request = fetcher(
          `${UNS_REMOTE_ROUTES.notification}/${notificationId}?${params}`,
          {
            method: "GET",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
            },
          },
        ).request;
        return typedFetch(request);
      },
      delete: (
        pushId: string,
        notificationId: string,
      ): Promise<ApiResult<void>> => {
        const params = new URLSearchParams({ externalUserID: pushId });
        const request = fetcher(
          `${UNS_REMOTE_ROUTES.notification}/${notificationId}?${params}`,
          {
            method: "DELETE",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
            },
          },
        ).request;
        return typedFetch(request);
      },
      patch: (
        pushId: string,
        notificationId: string,
        body: NotificationPatchBody,
      ): Promise<ApiResult<void>> => {
        const params = new URLSearchParams({ externalUserID: pushId });
        const request = fetcher(
          `${UNS_REMOTE_ROUTES.notification}/${notificationId}/status?${params}`,
          {
            method: "PATCH",
            headers: {
              ...defaultHeaders,
              "X-API-KEY": config.apiKey,
            },
            body: JSON.stringify(body),
          },
        ).request;
        return typedFetch(request);
      },
    },
    notifications: {
      get: (pushId: string): Promise<ApiResult<void>> => {
        const params = new URLSearchParams({ externalUserID: pushId });
        const request = fetcher(`${UNS_REMOTE_ROUTES.notification}?${params}`, {
          method: "GET",
          headers: {
            ...defaultHeaders,
            "X-API-KEY": config.apiKey,
          },
        }).request;
        return typedFetch(request);
      },
    },
  };
}

export type UnsRemoteClient = ReturnType<typeof createUnsRemoteClient>;
