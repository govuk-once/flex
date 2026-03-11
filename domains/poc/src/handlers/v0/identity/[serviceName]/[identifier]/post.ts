import createHttpError from "http-errors";

import { route } from "../../../../../../domain.config";

export const handler = route(
  "POST /v0/identity/:serviceName/:identifier",
  async ({ auth, integrations, logger, pathParams }) => {
    const { identifier, serviceName } = pathParams;

    const result = await integrations.udpWrite({
      path: `/identity/${serviceName}/${identifier}`,
      body: { appId: auth.pairwiseId },
    });

    if (!result.ok) {
      const { status, body } = result.error;

      logger.error("Failed to link service identity", { status, body });

      throw new createHttpError.BadGateway();
    }

    return { status: 201 };
  },
);
