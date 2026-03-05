import { getLogger } from "@flex/logging";

import { UdpDomainClient } from "../client";

export const postIdentityService = async ({
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
  try {
    await client.gateway.createServiceLink(service, serviceId, {
      appId,
    });

    logger.info("service ID has now been linked to app ID");
  } catch (error) {
    console.log(error);
  }
};
