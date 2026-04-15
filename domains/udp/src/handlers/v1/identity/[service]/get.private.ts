import { route } from "@domain";
import { UserId } from "@flex/utils";
import createHttpError from "http-errors";
import status from "http-status";

import { getServiceIdentityLink } from "../../../../services/identity";

export const handler = route(
  "GET /v1/identity/:service [private]",
  async ({ headers }) => {
    const userId = headers.userId as UserId;
    const linked = await getServiceIdentityLink(userId);

    if (!linked) {
      throw new createHttpError.NotFound();
    }

    return {
      status: status.OK,
      data: linked,
    };
  },
);
