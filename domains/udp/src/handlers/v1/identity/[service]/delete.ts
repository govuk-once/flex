import { route } from "@domain";
import { UserId } from "@flex/utils";
import createHttpError from "http-errors";
import status from "http-status";

import {
  deleteServiceIdentity,
  getServiceIdentityLink,
} from "../../../../services/identity";

export const handler = route(
  "DELETE /v1/identity/:service",
  async ({ auth }) => {
    const linked = await getServiceIdentityLink(auth.pairwiseId as UserId);

    if (!linked) {
      throw new createHttpError.NotFound();
    }

    await deleteServiceIdentity(linked.serviceName, linked.serviceId);

    return { status: status.NO_CONTENT };
  },
);
