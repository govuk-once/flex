import createHttpError from "http-errors";

import { route } from "../../../../../domain.config";

export const handler = route(
  "GET /v1/local-council/:id [private]",
  async ({ pathParams, integrations, logger }) => {
    const { id } = pathParams;

    const result = await integrations.udpGetLocalAuthority({
      path: `/${id}`,
    });

    if (!result.ok) {
      const { status } = result.error;

      if (status === 404) {
        throw new createHttpError.NotFound();
      }

      logger.error("Failed to get local authority", {
        status,
        body: result.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    return { status: 200, data: result.data };
  },
);
