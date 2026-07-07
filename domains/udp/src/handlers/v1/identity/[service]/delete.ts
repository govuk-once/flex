import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { getServiceIdentityLink, deleteServiceIdentity } from "@services/identity";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route("DELETE /v1/identity/:service", async (ctx) => {
  const { auth, pathParams } = ctx;
  const service = pathParams.service.toLowerCase();

  // TODO: SDK auth alias
  const userId = auth.pairwiseId as UserId;

  const identity = await getServiceIdentityLink(userId, service);
  if (!identity) throw new createHttpError.NotFound();

  await deleteServiceIdentity(identity.serviceName, identity.serviceId);

  /**
   * NOTE:
   * - Commenting out for now as causing issues due to deleting the linking id
   *   on DVLA side
   */
  // if (service === "dvla") {
  //   await integrations.dvlaUnlinkUser({
  //     body: {},
  //     path: `/${identity.serviceId}`,
  //   });
  // }

  return { status: status.NO_CONTENT };
});
