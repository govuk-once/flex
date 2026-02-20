import { createSigv4Fetcher, typedFetch } from "@flex/flex-fetch";

import {
  PreferencesRequest,
  preferencesResponseSchema,
} from "../schemas/preferences";
import { CreateUserRequest } from "../schemas/user";
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

  return {
    gateway: {
      getPreferences: () => {
        const { request } = gatewayFetcher(UDP_GATEWAY_ROUTES.preferences);
        return typedFetch(request, preferencesResponseSchema);
      },
      updatePreferences: (body: PreferencesRequest) => {
        const { request } = gatewayFetcher(UDP_GATEWAY_ROUTES.preferences, {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
          },
        });
        return typedFetch(request);
      },
    },
    domain: {
      createUser: (body: CreateUserRequest) => {
        const { request } = domainFetcher(UDP_DOMAIN_ROUTES.createUser, {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
          },
        });
        return typedFetch(request);
      },
    },
  };
}
