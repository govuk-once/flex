import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { getServiceIdentityLink } from "@services/identity";
import createHttpError from "http-errors";
import status from "http-status";

export const handler = route(
  "GET /v1/identity/:service [private]",
  async ({ headers, pathParams }) => {
    // TODO: SDK auth alias
    const userId = headers.userId as UserId;
    const service = pathParams.service.toLowerCase();

    const identity = await getServiceIdentityLink(userId, service);
    if (!identity) {
      throw new createHttpError.NotFound();
    }

    return { status: status.OK, data: identity };
  },
);
