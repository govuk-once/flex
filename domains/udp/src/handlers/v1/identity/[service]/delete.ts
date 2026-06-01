import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { updateIdentityList } from "@services/identities";
import {
  deleteServiceIdentity,
  getServiceIdentityLink,
} from "@services/identity";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route(
  "DELETE /v1/identity/:service",
  async (ctx) => {
    const { auth, pathParams, integrations } = ctx;

    // TODO: SDK auth alias
    const userId = auth.pairwiseId as UserId;

    const identity = await getServiceIdentityLink(userId);

    if (!identity) throw new createHttpError.NotFound();

    /**
     * NOTE:
     * For now ignoring the response from DVLA as they are just returning 404
     */
    if (pathParams.service === "dvla") {
      await integrations.dvlaUnlinkUser({
        body: {},
        path: `/${identity.serviceId}`,
      });
    }

    await Promise.all([
      deleteServiceIdentity(identity.serviceName, identity.serviceId),
      updateIdentityList(ctx, pathParams.service, "remove"),
    ]);

    return { status: status.NO_CONTENT };
  },
);
