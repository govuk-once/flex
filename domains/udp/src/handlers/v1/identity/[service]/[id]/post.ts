import { route } from "@domain";
import type { UserId } from "@flex/utils";
import {
  deleteServiceIdentity,
  getServiceIdentityLink,
  postServiceIdentity,
} from "@services/identity";
import status from "http-status";

export const handler = route(
  "POST /v1/identity/:service/:id",
  async ({ pathParams, auth }) => {
    const { id: serviceId } = pathParams;

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

    await postServiceIdentity();

    return { status: status.CREATED };
  },
);
