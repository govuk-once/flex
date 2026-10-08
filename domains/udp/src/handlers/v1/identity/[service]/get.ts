import { route } from "@domain";
import { getServiceIdentityLink } from "@services/identity";
import status from "http-status";

export const handler = route(
  "GET /v1/identity/:service",
  async ({ auth, pathParams }) => {
    const userId = auth.pairwiseId;
    const service = pathParams.service.toLowerCase();

    const identity = await getServiceIdentityLink(userId, service);

    return {
      status: status.OK,
      data: { linked: Boolean(identity) },
    };
  },
);
