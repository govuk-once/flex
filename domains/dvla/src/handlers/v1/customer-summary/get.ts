import { route } from "@domain";
import { status } from "http-status";

import {
  getDvlaAuthToken,
  getUserLinkingId,
} from "../../../services/authentication";
import { handleStandardErrors } from "../../../services/errors";

const endpoint = "GET /v1/customer-summary";

export const handler = route(endpoint, async (ctx) => {
  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await ctx.integrations.dvlaCustomerSummary({
    path: `/${userLinkingId}`,
    headers: { auth: auth },
  });

  handleStandardErrors(response, endpoint);

  return {
    status: status.OK,
    data: response.data,
  };
});
