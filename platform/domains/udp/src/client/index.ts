import { createSigv4FetchWithCredentials, typedFetch } from "@flex/flex-fetch";

import { UDP_REMOTE_ROUTES } from "../contract/route";
import {
  CreateOrUpdateNotificationsRequest,
  createOrUpdateNotificationsResponseSchema,
  notificationsResponseSchema,
} from "../schemas/remote/notifications";
import { CreateUserRequest } from "../schemas/remote/user";
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
    user: {
      create: (body: CreateUserRequest) => {
        const { request } = fetcher(UDP_REMOTE_ROUTES.user, {
          method: "POST",
          body: JSON.stringify(body),
          headers: defaultHeaders,
        });
        return typedFetch(request);
      },
    },
    notifications: {
      get: (requestingServiceUserId: string) => {
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

      update: (
        body: CreateOrUpdateNotificationsRequest,
        requestingServiceUserId: string,
      ) => {
        const { request } = fetcher(UDP_REMOTE_ROUTES.notifications, {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            ...defaultHeaders,
            "requesting-service": "app",
            "requesting-service-user-id": requestingServiceUserId,
          },
        });
        return typedFetch(request, createOrUpdateNotificationsResponseSchema);
      },
    },
  };
}

export type UdpRemoteClient = ReturnType<typeof createUdpRemoteClient>;
