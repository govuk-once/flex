import { route } from "@domain";
import type { UserId } from "@flex/utils";
import type { CreateServiceIdentityLinkRequest } from "@schemas/identity";
import createHttpError from "http-errors";

export const handler = route(
  "POST /v1/identity/:service/:id",
  async ({ auth, integrations, logger, pathParams }) => {
    const { service, id: serviceId } = pathParams;

    // TODO: Add to SDK auth or keep alias for this domain only?
    const userId = auth.pairwiseId as UserId;

    const result =
      await integrations.udpCreateIdentity<CreateServiceIdentityLinkRequest>({
        path: `/${service}/${serviceId}`,
        body: { appId: userId },
      });

    if (!result.ok) {
      logger.error(`Failed to link service identity`, {
        userId,
        service,
        serviceId,
        error: result.error,
      });

      throw new createHttpError.BadGateway();
    }

    logger.info("Service identity linked successfully", {
      userId,
      service,
      serviceId,
    });

    return { status: 201 };
  },
);
