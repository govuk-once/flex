import { route } from "@domain";
import { getIdentityLink } from "@services/get-identity-link";
import { createUserId } from "@utils/parser";
import createHttpError from "http-errors";

export const handler = route(
  "GET /v0/identity/:service [private]",
  async ({ headers }) => {
    const userId = createUserId(headers.userId);
    const linked = await getIdentityLink(userId);

    if (!linked) {
      throw new createHttpError.NotFound();
    }

    return { status: 200, data: linked };
  },
);
