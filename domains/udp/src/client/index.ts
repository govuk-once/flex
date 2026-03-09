import { createSigv4Fetcher, typedFetch } from "@flex/flex-fetch";
import type { UserId } from "@flex/utils";
import { IdentityRequest } from "@schemas/identity";
import {
  CreateNotificationRequest,
  createNotificationResponseSchema,
  getNotificationResponseSchema,
  UpdateNotificationOutboundRequest,
} from "@schemas/notifications";
import { CreateUserRequest } from "@schemas/user";

import {
  UDP_DOMAIN_BASE,
  UDP_DOMAIN_ROUTES,
  UDP_GATEWAY_BASE,
  UDP_GATEWAY_ROUTES,
} from "./routes";

export interface UdpDomainClientOptions {
  region: string;
  baseUrl: string;
}

export type UdpDomainClient = ReturnType<typeof createUdpDomainClient>;

/**
 * UDP domain client for calling the internal API gateway.
 *
 * Centralizes SigV4 auth, base URLs, and requesting-service headers for all
 * UDP domain → internal API calls.
 */
export function createUdpDomainClient({
  region,
  baseUrl,
}: UdpDomainClientOptions) {
  const gatewayFetcher = createSigv4Fetcher({
    region,
    baseUrl: `${baseUrl}${UDP_GATEWAY_BASE}`,
  });

  const domainFetcher = createSigv4Fetcher({
    region,
    baseUrl: `${baseUrl}${UDP_DOMAIN_BASE}`,
  });

  const defaultHeaders = {
    "Content-Type": "application/json",
  };

  return {
    gateway: {
      users: {
        create: (body: CreateUserRequest) => {
          const { request } = gatewayFetcher(UDP_GATEWAY_ROUTES.users, {
            method: "POST",
            body: JSON.stringify(body),
            headers: defaultHeaders,
          });
          return typedFetch(request);
        },
      },
      createServiceLink: (
        service: string,
        serviceId: string,
        body: IdentityRequest,
      ) => {
        const { request } = gatewayFetcher(
          `${UDP_GATEWAY_ROUTES.postIdentity}/${service}/${serviceId}`,
          {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
        return typedFetch(request);
      },
      notifications: {
        get: (userId: UserId) => {
          const { request } = gatewayFetcher(UDP_GATEWAY_ROUTES.notifications, {
            method: "GET",
            headers: {
              "requesting-service-user-id": userId,
            },
          });
          return typedFetch(request, getNotificationResponseSchema);
        },
        update: (
          body: UpdateNotificationOutboundRequest,
          requestingServiceUserId: UserId,
        ) => {
          const { request } = gatewayFetcher(UDP_GATEWAY_ROUTES.notifications, {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
              ...defaultHeaders,
              "requesting-service-user-id": requestingServiceUserId,
            },
          });
          return typedFetch(request, createNotificationResponseSchema);
        },
        create: (
          body: CreateNotificationRequest,
          requestingServiceUserId: UserId,
        ) => {
          const { request } = gatewayFetcher(UDP_GATEWAY_ROUTES.notifications, {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
              ...defaultHeaders,
              "requesting-service-user-id": requestingServiceUserId,
            },
          });
          return typedFetch(request, createNotificationResponseSchema);
        },
      },
    },
    domain: {
      user: {
        create: (body: CreateUserRequest) => {
          const { request } = domainFetcher(UDP_DOMAIN_ROUTES.createUser, {
            method: "POST",
            body: JSON.stringify(body),
            headers: defaultHeaders,
          });
          return typedFetch(request);
        },
      },
    },
  };
}
