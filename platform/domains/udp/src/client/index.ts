import {
  ApiResult,
  createSigv4FetchWithCredentials,
  typedFetch,
} from "@flex/flex-fetch";

import {
  PreferencesRequest,
  preferencesResponseSchema,
} from "../schemas/remote/preferences";
import {
  CreateUserRequest,
  CreateUserResponse,
  createUserResponseSchema,
} from "../schemas/remote/user";
import { ConsumerConfig } from "../utils/getConsumerConfig";
import { UDP_REMOTE_ROUTES } from "./routes";

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
      return typedFetch(request, preferencesResponseSchema);
    },

    updatePreferences: (
      body: PreferencesRequest,
      requestingServiceUserId: string,
    ): Promise<ApiResult<unknown>> => {
      const { request } = fetcher(UDP_REMOTE_ROUTES.notifications, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          ...defaultHeaders,
          "requesting-service": "app",
          "requesting-service-user-id": requestingServiceUserId,
        },
      });
      return typedFetch(request, preferencesResponseSchema);
    },

    createUser: (
      body: CreateUserRequest,
    ): Promise<ApiResult<CreateUserResponse>> => {
      const { request } = fetcher(UDP_REMOTE_ROUTES.user, {
        method: "POST",
        body: JSON.stringify(body),
        headers: defaultHeaders,
      });
      return typedFetch(request, createUserResponseSchema);
    },
  };
}

export type UdpRemoteClient = ReturnType<typeof createUdpRemoteClient>;
