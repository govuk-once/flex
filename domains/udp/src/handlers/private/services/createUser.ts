import { createUdpDomainClient } from "../../../client";

export const createUser = async ({
  privateGatewayUrl,
  awsRegion,
  pairwiseId,
  notificationId,
}: {
  privateGatewayUrl: string;
  awsRegion: string;
  pairwiseId: string;
  notificationId: string;
}) => {
  const baseUrl = new URL(privateGatewayUrl);
  const client = createUdpDomainClient({
    region: awsRegion,
    baseUrl,
    pairwiseId,
  });
  const response = await client.gateway.createUser({
    notificationId,
  });
  return response;
};
