import { route } from "@domain";
import status from "http-status";

import { getServiceIdentityLink } from "../../../../services/identity";

export const handler = route("GET /v1/identity/:service", async () => {
  const data = await getServiceIdentityLink();

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
