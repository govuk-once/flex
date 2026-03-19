import { UdpDomainClient } from "@client";
import { logger } from "@flex/logging";
import { UserId } from "@flex/utils";
import { identityGetSchema } from "@schemas/identity";
import createHttpError from "http-errors";
import { status } from "http-status";

export const createIdentityService = async ({
  client,
  service,
  serviceId,
  userId,
}: {
  client: UdpDomainClient;
  service: string;
  serviceId: string;
  userId: UserId;
}) => {
  const response = await client.gateway.serviceLink.create(service, serviceId, {
    appId: userId,
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
  userId,
}: {
  client: UdpDomainClient;
  service: string;
  userId: string;
}) => {
  const exchangeResponse = await client.gateway.serviceLink.get(
    service,
    userId,
  );

  if (!exchangeResponse.ok) {
    if (exchangeResponse.error.status === status.NOT_FOUND) {
      logger.warn("Service link not found during deletion", { service });

      throw new createHttpError.NotFound("The service link does not exist.");
    }

    logger.error("Failed to unlink app ID to service ID", {
      status: exchangeResponse.error.status,
      errorBody: exchangeResponse.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  const { serviceId } = identityGetSchema.parse(exchangeResponse.data);

  const deleteResponse = await client.gateway.serviceLink.delete(
    service,
    serviceId,
  );

  if (!deleteResponse.ok) {
    logger.error("Failed to unlink app ID to service ID", {
      status: deleteResponse.error.status,
      errorBody: deleteResponse.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  logger.info("service ID has now been unlinked to app ID");
};

export const getIdentityService = async ({
  client,
  service,
  userId,
}: {
  client: UdpDomainClient;
  service: string;
  userId: string;
}) => {
  const exchangeResponse = await client.gateway.serviceLink.get(
    service,
    userId,
  );

  if (!exchangeResponse.ok) {
    if (exchangeResponse.error.status === status.NOT_FOUND) {
      return { linked: false };
    }

    logger.error("Failed to verify if user has existing service link", {
      status: exchangeResponse.error.status,
      errorBody: exchangeResponse.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  return { linked: true };
};
