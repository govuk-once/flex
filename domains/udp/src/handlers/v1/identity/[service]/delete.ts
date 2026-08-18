import { route } from "@domain";
import type { UserId } from "@flex/utils";
import {
  deleteServiceIdentity,
  getServiceIdentityLink,
} from "@services/identity";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route("DELETE /v1/identity/:service", async (ctx) => {
  const { auth, pathParams, integrations, logger, resources } = ctx;
  const { environment } = resources;
  const service = pathParams.service.toLowerCase();

  // TODO: SDK auth alias
  const userId = auth.pairwiseId as UserId;

  const identity = await getServiceIdentityLink(userId, service);
  if (!identity) throw new createHttpError.NotFound();

  /**
   * Must run before deleteServiceIdentity, DVLA runs its own lookup to verify matching IDs
   * Note:
   * - On none production envs we will not call dvla as this will delete the
   *   linking id and causes issues with the e2e tests
   */
  if (service === "dvla" && environment === "production") {
    const result = await integrations.dvlaUnlinkUser({
      headers: { "User-Id": userId },
      body: {},
    });

    /**
     * NOTE:
     *  - Log response from DVLA but still unlink user regardless if successful
     *    or not.
     */
    logger.info(JSON.stringify(result));
  }

  await deleteServiceIdentity(identity.serviceName, identity.serviceId);

  return { status: status.NO_CONTENT };
});
