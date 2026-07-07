import { route } from "@domain";
import type { UserId } from "@flex/utils";
import {
  deleteServiceIdentity,
  getServiceIdentityLink,
  postServiceIdentity,
} from "@services/identity";
import { extractServiceId } from "@services/linkingId";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route("POST /v1/identity/:service", async (ctx) => {
  const { pathParams, auth, logger, headers } = ctx;
  const { linkingToken } = headers;
  const service = pathParams.service.toLowerCase();

  const serviceId = await extractServiceId(service, linkingToken, ctx);
  if (serviceId === null) {
    logger.error(`Failed to get linking id`, {
      service,
      serviceId,
    });
    throw new createHttpError.Unauthorized();
  }

  // TODO: SDK auth alias
  const userId = auth.pairwiseId as UserId;
  const identity = await getServiceIdentityLink(userId, service);

  if (identity) {
    if (identity.serviceId === serviceId) {
      return { status: status.NO_CONTENT };
    }

    /** Remove old linking ID and update with new linking ID */
    await deleteServiceIdentity(identity.serviceName, identity.serviceId);
  }

  await postServiceIdentity(serviceId, service)

  return { status: status.CREATED };
});
