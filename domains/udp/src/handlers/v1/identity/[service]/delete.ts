import { route } from "@domain";
import type { UserId } from "@flex/utils";
import {
  deleteServiceIdentity,
  getServiceIdentityLink,
} from "@services/identity";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route("DELETE /v1/identity/:service", async (ctx) => {
  const { auth, pathParams, integrations, logger } = ctx;
  const service = pathParams.service.toLowerCase();

  // TODO: SDK auth alias
  const userId = auth.pairwiseId as UserId;

  const identity = await getServiceIdentityLink(userId, service);
  if (!identity) throw new createHttpError.NotFound();

  await deleteServiceIdentity(identity.serviceName, identity.serviceId);

  if (service === "dvla") {
    const result = await integrations.dvlaUnlinkUser({
      body: {},
      path: `/${identity.serviceId}`,
    });

    /**
     * NOTE:
     *  - Log response from DVLA but still unlink user regardless if successful
     *    or not.
     */
    logger.info(JSON.stringify(result));
  }

  return { status: status.NO_CONTENT };
});
