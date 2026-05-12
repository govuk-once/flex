import { config, route } from "@domain";
import { InferRouteContext } from "@flex/sdk";
import createHttpError from "http-errors";
import { status } from "http-status";

import {
  getDvlaAuthToken,
  getUserLinkingId,
} from "../../../services/authentication";
import { handleStandardErrors } from "../../../services/errors";

const endpoint = "POST /v1/test-notification";

export const handler = route(endpoint, async (ctx) => {
  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const response = await ctx.integrations.dvlaTestNotification({
    body: {},
    headers: { auth: auth },
    path: `/${userLinkingId}`,
  });

  handleStandardErrors(response, endpoint);

  return {
    status: status.ACCEPTED,
  };
});
