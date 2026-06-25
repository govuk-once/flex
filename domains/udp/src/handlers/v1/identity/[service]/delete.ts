import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { deleteOrchestrateIdentityUnlink } from "@services/identities";
import { getServiceIdentityLink } from "@services/identity";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route("DELETE /v1/identity/:service", async (ctx) => {
  const { auth, pathParams } = ctx;
  const service = pathParams.service.toLowerCase();

  // TODO: SDK auth alias
  const userId = auth.pairwiseId as UserId;

  const identity = await getServiceIdentityLink(userId, service);
  if (!identity) throw new createHttpError.NotFound();

  /**
   * NOTE:
   * - Commenting out for now as causing issues due to deleting the linking id
   */
  // if (service === "dvla") {
  //   await integrations.dvlaUnlinkUser({
  //     body: {},
  //     path: `/${identity.serviceId}`,
  //   });
  // }

  await deleteOrchestrateIdentityUnlink({
    ctx,
    userId,
    service,
    serviceId: identity.serviceId,
  });

  return { status: status.NO_CONTENT };
});
