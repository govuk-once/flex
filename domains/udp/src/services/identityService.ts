import { getLogger } from "@flex/logging";
import createHttpError from "http-errors";

import { UdpDomainClient } from "../client";

export const createIdentityService = async ({
  client,
  service,
  serviceId,
  appId,
}: {
  client: UdpDomainClient;
  service: string;
  serviceId: string;
  appId: string;
}) => {
  const logger = getLogger();

  const response = await client.gateway.serviceLink.create(service, serviceId, {
    appId,
  });

  if (!response.ok) {
    logger.error("Failed to link app ID to service ID", {
      response: JSON.stringify(response),
      status: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  logger.info("service ID has now been linked to app ID");
};

export const deleteIdentityService = async ({
  client,
  service,
  appId,
}: {
  client: UdpDomainClient;
  service: string;
  appId: string;
}) => {
  const logger = getLogger();

  const response = await client.gateway.serviceLink.delete(service, {
    appId,
  });

  if (!response.ok) {
    logger.error("Failed to unlink app ID to service ID", {
      response: JSON.stringify(response),
      status: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  logger.info("service ID has now been unlinked to app ID");
};
