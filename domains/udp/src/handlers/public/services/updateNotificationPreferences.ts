import { createUdpDomainClient } from "../../../client";
import { CONSENT_STATUS } from "../../../schemas";

export const updateNotificationPreferences = async ({
  privateGatewayUrl,
  awsRegion,
  pairwiseId,
  consentStatus,
  updatedAt,
}: {
  privateGatewayUrl: string;
  awsRegion: string;
  pairwiseId: string;
  consentStatus: CONSENT_STATUS;
  updatedAt: string;
}) => {
  const baseUrl = new URL(privateGatewayUrl);
  const client = createUdpDomainClient({
    region: awsRegion,
    baseUrl,
    pairwiseId,
  });
  const response = await client.gateway.postNotifications({
    data: {
      consentStatus,
      updatedAt,
    },
  });

  return response;
};
