import { route } from "@domain";
import createHttpError from "http-errors";
import status from "http-status";

import {
  deleteServiceIdentity,
  getServiceIdentityLink,
} from "../../../../services/identity";

export const handler = route("DELETE /v1/identity/:service", async () => {
  const linked = await getServiceIdentityLink();

  if (!linked) {
    throw new createHttpError.NotFound();
  }

  await deleteServiceIdentity(linked.serviceName, linked.serviceId);

  return { status: status.NO_CONTENT };
});
