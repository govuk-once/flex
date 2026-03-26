import { routeContext } from "@domain";
import { UserId } from "@flex/utils";
import {
  CreateServiceIdentityLinkRequest,
  DeleteServiceIdentityLinkResponse,
  GetServiceIdentityLinkResponse,
} from "@schemas";
import createHttpError from "http-errors";

type PostRoute = "POST /v1/identity/:service/:id";
type DeleteRoute = "DELETE /v1/identity/:service";
type GetRoute = "GET /v1/identity/:service";
type GetRoutePrivate = "GET /v1/identity/:service [private]";

type PostIdentityRoutes = PostRoute;
type DeleteIdentityRoutes = PostRoute | DeleteRoute;
type GetIdentityRoutes = GetRoute | GetRoutePrivate | DeleteIdentityRoutes;

const postCtx = routeContext<PostIdentityRoutes>;
const deleteCtx = routeContext<DeleteIdentityRoutes>;
const getCtx = routeContext<GetIdentityRoutes>;

export async function postServiceIdentity() {
  const { auth, integrations, logger, pathParams } = postCtx();
  const { service, id: serviceId } = pathParams;
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
}

export async function deleteServiceIdentity(
  service: string,
  serviceId: string,
) {
  const { auth, integrations, logger } = deleteCtx();
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

export async function getServiceIdentityLink(
  userId: UserId,
): Promise<GetServiceIdentityLinkResponse | null> {
  const { integrations, logger, pathParams } = getCtx();
  const { service } = pathParams;

  const result =
    await integrations.udpGetIdentity<GetServiceIdentityLinkResponse>({
      path: `/${service}`,
      headers: { "User-Id": userId },
    });

  if (!result.ok) {
    if (result.error.status === 404) {
      logger.debug("Service identity link not found", { userId, service });
      return null;
    }

    logger.error("Failed to fetch service identity", {
      userId,
      service,
      error: result.error,
    });
    throw new createHttpError.BadGateway();
  }

  logger.debug("Service identity link found");
  return result.data;
}
