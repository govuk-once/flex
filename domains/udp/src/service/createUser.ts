import { getLogger } from "@flex/logging";
import { createSigv4Fetch, sigv4Fetch } from "@flex/utils";
import createHttpError from "http-errors";
import status from "http-status";

import { SERVICE_NAME } from "../constants";
import {
  buildPrivateGatewayUrl,
  UDP_DOMAIN_BASE,
  UDP_DOMAIN_ROUTES,
  UDP_GATEWAY_BASE,
  UDP_ROUTES,
} from "../routes";

interface CreateUserOrchestratorOptions {
  region: string;
  baseUrl: URL;
  pairwiseId: string;
  notificationId: string;
}

const setDefaultUserSettings = async (
  region: string,
  baseUrl: URL,
  pairwiseId: string,
) => {
  const logger = getLogger();

  const udpFetch = createSigv4Fetch({
    region,
    baseUrl: buildPrivateGatewayUrl(baseUrl, UDP_GATEWAY_BASE),
    headers: {
      "requesting-service": SERVICE_NAME,
      "requesting-service-user-id": pairwiseId,
    },
  });
  logger.info("Setting user consent status to unknown");
  const responses = await Promise.all([
    udpFetch({
      method: "POST",
      path: UDP_ROUTES.notifications,
      body: {
        data: {
          consentStatus: "unknown",
          updatedAt: new Date().toISOString(),
        },
      },
    }),
    udpFetch({
      method: "POST",
      path: UDP_ROUTES.analytics,
      body: {
        data: {
          consentStatus: "unknown",
          updatedAt: new Date().toISOString(),
        },
      },
    }),
  ]);

  if (!responses.every((response) => response.ok)) {
    logger.error("Failed to set user consent status", {
      status: responses.map((response) => response.status),
      statusText: responses.map((response) => response.statusText),
    });
    throw new Error(
      `Failed to set user consent status: ${responses.map((response) => response.statusText).join(", ")}`,
    );
  }
};

export const createUserOrchestrator = async ({
  region,
  baseUrl,
  pairwiseId,
  notificationId,
}: CreateUserOrchestratorOptions) => {
  const logger = getLogger();
  const url = buildPrivateGatewayUrl(baseUrl, UDP_DOMAIN_BASE);
  const response = await sigv4Fetch({
    region,
    baseUrl: url,
    method: "POST",
    path: UDP_DOMAIN_ROUTES.user,
    body: {
      notificationId,
      appId: pairwiseId,
    },
  });

  if (!response.ok) {
    logger.error("Private API returned non-OK", {
      status: response.status,
      statusText: response.statusText,
    });
    throw new createHttpError.BadGateway();
  }

  logger.info("Setting user consent status to unknown");
  await setDefaultUserSettings(region, baseUrl, pairwiseId);
};
