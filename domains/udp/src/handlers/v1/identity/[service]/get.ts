import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { getServiceIdentityLink } from "@services/identity";
import status from "http-status";

export const handler = route(
  "GET /v1/identity/:service",
  async ({ auth, pathParams }) => {
    // TODO: SDK auth alias
    const userId = auth.pairwiseId as UserId;
    const service = pathParams.service.toLowerCase();

    const identity = await getServiceIdentityLink(userId, service);

    return {
      status: status.OK,
      data: { linked: Boolean(identity) },
    };
  },
);
