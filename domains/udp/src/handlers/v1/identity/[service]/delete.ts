import { route, routeContext } from "@domain";
import type { UserId } from "@flex/utils";
import type {
  DeleteServiceIdentityLinkResponse,
  GetServiceIdentityLinkResponse,
} from "@schemas/identity";
import createHttpError from "http-errors";

const context = routeContext<"DELETE /v1/identity/:service">;

export const handler = route("DELETE /v1/identity/:service", async () => {
  const linked = await getServiceIdentityLink();

  await unlinkServiceIdentity(linked.serviceName, linked.serviceId);

  return { status: 204 };
});

async function getServiceIdentityLink(): Promise<GetServiceIdentityLinkResponse> {
  const { auth, integrations, logger, pathParams } = context();

  const { service } = pathParams;

  // TODO: Add to SDK auth or keep alias for this domain only?
  const userId = auth.pairwiseId as UserId;

  const result =
    await integrations.udpGetIdentity<GetServiceIdentityLinkResponse>({
      path: `/${service}`,
      headers: { "User-Id": userId },
    });

  if (!result.ok) {
    const { error } = result;

    if (error.status === 404) {
      const reason = "Service identity link does not exist";

      logger.warn(reason, { userId, service, error });

      throw new createHttpError.NotFound(reason);
    }

    logger.error("Failed to unlink service identity", {
      userId,
      service,
      error,
    });

    throw new createHttpError.BadGateway();
  }

  logger.info("Service identity link found");

  return result.data;
}

async function unlinkServiceIdentity(service: string, serviceId: string) {
  const { auth, integrations, logger } = context();

  // TODO: Add to SDK auth or keep alias for this domain only?
  const userId = auth.pairwiseId as UserId;

  const result =
    await integrations.udpDeleteIdentity<DeleteServiceIdentityLinkResponse>({
      path: `/${service}/${serviceId}`,
    });

  if (!result.ok) {
    logger.error("Failed to unlink service identity", {
      userId,
      service,
      serviceId,
      error: result.error,
    });

    throw new createHttpError.BadGateway();
  }

  logger.info("Service identity unlinked successfully");
}
