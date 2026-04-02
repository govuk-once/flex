import { routeContext } from "@domain";
import type { GetServiceIdentityLinkResponse } from "@flex/udp-domain";
import type { UserId } from "@flex/utils";
import createHttpError from "http-errors";

type IdentityRoutes =
  | "GET /v0/identity/:service"
  | "GET /v0/identity/:service [private]";

const context = routeContext<IdentityRoutes>;

export async function getIdentityLink(
  userId: UserId,
): Promise<GetServiceIdentityLinkResponse | null> {
  const { integrations, logger, pathParams } = context();

  const { service } = pathParams;

  const result =
    await integrations.udpGetIdentity<GetServiceIdentityLinkResponse>({
      path: `/${service}`,
      headers: { "User-Id": userId },
    });

  if (result.ok) {
    logger.info("Identity link found", { service, userId });
    return result.data;
  }

  const { error } = result;

  if (error.status === 404) {
    logger.debug("Identity link does not exist", { service, error, userId });
    return null;
  }

  logger.error("Failed to fetch identity link", { service, error, userId });
  throw new createHttpError.BadGateway();
}
