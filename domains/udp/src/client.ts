import { createSigv4Fetch, sigv4Fetch } from "@flex/flex-fetch";
import { parseResponseBodyTyped } from "@flex/utils";
import createHttpError from "http-errors";

import {
  buildPrivateGatewayUrl,
  UDP_DOMAIN_BASE,
  UDP_DOMAIN_ROUTES,
  UDP_GATEWAY_BASE,
  UDP_GATEWAY_ROUTES,
} from "./routes";
import type { ConsentData } from "./schemas";
import { CONSENT_STATUS, consentResponseSchema } from "./schemas";

function normalizeConsentData(
  parsed: { data: ConsentData } | ConsentData,
): ConsentData {
  return "data" in parsed ? parsed.data : parsed;
}

async function fetchConsent(
  fetchFn: () => Promise<Response>,
): Promise<{ response: Response; data: ConsentData | null }> {
  const response = await fetchFn();
  if (response.status === 404) return { response, data: null };
  if (response.status >= 500) throw createHttpError.BadGateway();
  const result = await parseResponseBodyTyped(response, consentResponseSchema);
  return { response, data: normalizeConsentData(result.data) };
}

export interface UdpDomainClientOptions {
  region: string;
  baseUrl: URL;
  pairwiseId: string;
}

export type UdpDomainClient = ReturnType<typeof createUdpDomainClient>;

/**
 * UDP domain client for calling the private API gateway.
 *
 * Centralizes SigV4 auth, base URLs, and requesting-service headers for all
 * UDP domain → private API calls. Use this for ACL-correct, least-privilege
 * access to gateway and domain routes.
 */
export function createUdpDomainClient({
  region,
  baseUrl,
  pairwiseId,
}: UdpDomainClientOptions) {
  const serviceName = "app";
  const gatewayFetch = createSigv4Fetch({
    region,
    baseUrl: buildPrivateGatewayUrl(baseUrl, UDP_GATEWAY_BASE),
    headers: {
      "requesting-service": serviceName,
      "requesting-service-user-id": pairwiseId,
    },
  });

  const domainBaseUrl = buildPrivateGatewayUrl(baseUrl, UDP_DOMAIN_BASE);

  return {
    gateway: {
      getNotifications: () =>
        fetchConsent(() =>
          gatewayFetch({
            method: "GET",
            path: UDP_GATEWAY_ROUTES.notifications,
          }),
        ),
      postNotifications: (body: {
        data: { consentStatus: CONSENT_STATUS; updatedAt: string };
      }) =>
        gatewayFetch({
          method: "POST",
          path: UDP_GATEWAY_ROUTES.notifications,
          body,
        }),
      createUser: ({ notificationId }: { notificationId: string }) =>
        gatewayFetch({
          method: "POST",
          path: UDP_GATEWAY_ROUTES.user,
          body: {
            notificationId,
            appId: pairwiseId,
          },
        }),
    },
    domain: {
      createUser: ({ notificationId }: { notificationId: string }) =>
        sigv4Fetch({
          region,
          baseUrl: domainBaseUrl,
          method: "POST",
          path: UDP_DOMAIN_ROUTES.user,
          body: {
            notificationId,
            appId: pairwiseId,
          },
        }),
    },
  };
}
