import createHttpError from "http-errors";

import { route } from "../../../../../../domain.config";

export const handler = route(
  "POST /v0/identity/:service/:id",
  async ({ auth, integrations, logger, pathParams }) => {
    const { service, id } = pathParams;

    const result = await integrations.udpCreateIdentityLink({
      path: `/${service}/${id}`,
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
