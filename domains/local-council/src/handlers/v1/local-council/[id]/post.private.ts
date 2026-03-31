import createHttpError from "http-errors";

import { route } from "../../../../../domain.config";

export const handler = route(
  "POST /v1/local-council/:id [private]",
  async ({ pathParams, body, integrations, logger }) => {
    const { id } = pathParams;

    const result = await integrations.udpSaveLocalAuthority({
      path: `/${id}`,
      body,
    });

    if (!result.ok) {
      logger.error("Failed to save local authority", {
        status: result.error.status,
        body: result.error.body,
      });

      throw new createHttpError.BadGateway();
    }

    return { status: 200 };
  },
);
