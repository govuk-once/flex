import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { updateIdentityList } from "@services/identities";
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
  const { service } = pathParams;
  const { linkingToken } = headers;

  const serviceId = await extractServiceId(service, linkingToken, ctx);
  if (serviceId === null) {
    logger.error(`Failed to get linking id`, {
      service,
      serviceId,
    });
    throw new createHttpError.BadRequest();
  }

  // TODO: SDK auth alias
  const userId = auth.pairwiseId as UserId;
  const identity = await getServiceIdentityLink(userId);

  if (identity) {
    if (identity.serviceId === serviceId) {
      return { status: status.NO_CONTENT };
    }

    /** Remove old link if user is already linked and has a new linking ID */
    await deleteServiceIdentity(identity.serviceName, identity.serviceId);
  }

  await Promise.all([
    postServiceIdentity(serviceId),
    updateIdentityList(ctx, pathParams.service, "append"),
  ]);

  return { status: status.CREATED };
});
