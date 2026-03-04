import {
  ApiResult,
  createSigv4FetchWithCredentials,
  typedFetch,
} from "@flex/flex-fetch";

import { UDP_REMOTE_ROUTES } from "../contract/route";
import {
  NotificationsResponse,
  notificationsResponseSchema,
  PreferencesRequest,
} from "../schemas/remote/preferences";
import { CreateUserRequest, CreateUserResponse } from "../schemas/remote/user";
import { ConsumerConfig } from "../utils/getConsumerConfig";

/**
 * Remote client for the UDP API.
 *
 * Typed methods per UdpRemoteContract. Validates responses with Zod schemas.
 * Private to the gateway package — domain services NEVER import from here.
 */
export function createUdpRemoteClient(config: ConsumerConfig) {
  const fetcher = createSigv4FetchWithCredentials({
    baseUrl: config.apiUrl,
    region: config.region,
    roleArn: config.consumerRoleArn,
    roleName: "consumer-session",
    externalId: config.externalId,
  });

  const defaultHeaders = {
    "Content-Type": "application/json",
    "x-api-key": config.apiKey,
    Accept: "application/json",
  };

  return {
    getPreferences: (requestingServiceUserId: string) => {
      const { request } = fetcher(UDP_REMOTE_ROUTES.notifications, {
        method: "GET",
        headers: {
          ...defaultHeaders,
          "requesting-service": "app",
          "requesting-service-user-id": requestingServiceUserId,
        },
      });
      return typedFetch(request, notificationsResponseSchema);
    },

    updatePreferences: (
      body: PreferencesRequest,
      requestingServiceUserId: string,
    ): Promise<ApiResult<NotificationsResponse>> => {
      const { request } = fetcher(UDP_REMOTE_ROUTES.notifications, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          ...defaultHeaders,
          "requesting-service": "app",
          "requesting-service-user-id": requestingServiceUserId,
        },
      });
      return typedFetch(request, notificationsResponseSchema);
    },

    createUser: (
      body: CreateUserRequest,
    ): Promise<ApiResult<CreateUserResponse>> => {
      const { request } = fetcher(UDP_REMOTE_ROUTES.user, {
        method: "POST",
        body: JSON.stringify(body),
        headers: defaultHeaders,
      });
      return typedFetch(request);
    },
  };
}

export type UdpRemoteClient = ReturnType<typeof createUdpRemoteClient>;
