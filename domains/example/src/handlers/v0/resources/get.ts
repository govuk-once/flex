import { route } from "@domain";

export const handler = route(
  "GET /v0/resources",
  async ({ logger, resources }) => {
    const {
      privateGatewayUrl,
      encryptionKeyArn,
      udpNotificationSecret, // pragma: allowlist secret
    } = resources;

    // async noop
    await Promise.resolve(null);

    logger.info("Deploy time resources resolved", resources);

    return {
      status: 200,
      data: {
        ssm: { param: privateGatewayUrl.length },
        secret: { secret: udpNotificationSecret.length }, // pragma: allowlist secret
        kms: { key: encryptionKeyArn.length },
      },
    };
  },
);
