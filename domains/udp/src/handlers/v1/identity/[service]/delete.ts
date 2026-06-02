import { route } from "@domain";
import type { UserId } from "@flex/utils";
import {
  deleteServiceIdentity,
  getServiceIdentityLink,
} from "@services/identity";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route(
  "DELETE /v1/identity/:service",
  async ({ auth, pathParams, integrations }) => {
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

    await deleteServiceIdentity(identity.serviceName, identity.serviceId);

    return { status: status.NO_CONTENT };
  },
);
