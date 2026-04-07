import { route } from "@domain";
import { UserId } from "@flex/utils";
import status from "http-status";

import { getServiceIdentityLink } from "../../../../services/identity";

export const handler = route("GET /v1/identity/:service", async ({ auth }) => {
  const data = await getServiceIdentityLink(auth.pairwiseId as UserId);

  if (!data) {
    return {
      status: status.OK,
      data: { linked: false },
    };
  }

  return {
    status: status.OK,
    data: { linked: true },
  };
});
