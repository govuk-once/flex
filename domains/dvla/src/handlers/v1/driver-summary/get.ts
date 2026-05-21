import { route } from "@domain";
import { status } from "http-status";

import {
  getDvlaAuthToken,
  getUserLinkingId,
} from "../../../services/authentication";
import { handleStandardErrors } from "../../../services/errors";

const endpoint = "GET /v1/driver-summary";

export const handler = route(endpoint, async (ctx) => {
  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await ctx.integrations.dvlaDriverSummary({
    path: `/${userLinkingId}`,
    headers: { auth: auth },
  });

  handleStandardErrors(response, endpoint);
  const { linkingId: _, ...body } = response.data;

  return {
    status: status.OK,
    data: body,
  };
});
