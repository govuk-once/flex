import { route } from "@domain";
import status from "http-status";

import {
  deleteServiceIdentity,
  getServiceIdentityLink,
  postServiceIdentity,
} from "../../../../../services/identity";

export const handler = route(
  "POST /v1/identity/:service/:id",
  async ({ pathParams }) => {
    const { id: requestedId } = pathParams;
    const existing = await getServiceIdentityLink();

    if (existing) {
      const isDifferentId = existing.serviceId !== requestedId;

      /** If user is already linked return 204 */
      if (!isDifferentId) {
        return { status: status.NO_CONTENT };
      }

      /** Remove old link if user is already linked and has a new linking ID */
      await deleteServiceIdentity(existing.serviceName, existing.serviceId);
    }

    await postServiceIdentity();

    return { status: status.CREATED };
  },
);
