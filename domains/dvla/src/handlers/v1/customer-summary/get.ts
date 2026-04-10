import { route } from "@domain";
import createHttpError from "http-errors";
import { status } from "http-status";

import {
  getDvlaAuthToken,
  getUserLinkingId,
} from "../../../services/authentication";

export const handler = route("GET /v1/customer-summary", async (ctx) => {
  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await ctx.integrations.dvlaCustomerSummary({
    path: `/${userLinkingId}`,
    headers: { auth: auth },
  });

  if (!response.ok) {
    ctx.logger.error("Failed to get customer summary with DVLA", {
      status: response.error.status,
      errorBody: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  return {
    status: status.OK,
    data: response.data,
  };
});
