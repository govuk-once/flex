import { config, route } from "@domain";
import { InferRouteContext } from "@flex/sdk";
import createHttpError from "http-errors";
import { status } from "http-status";

import {
  getDvlaAuthToken,
  getUserLinkingId,
} from "../../../services/authentication";

type PostDvlaNotificationContext = InferRouteContext<
  typeof config,
  "POST /v1/test-notification"
>;

export const handler = route("POST /v1/test-notification", async (ctx) => {
  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  await postDvlaTestNotification(ctx, auth, userLinkingId);

  return {
    status: status.ACCEPTED,
  };
});

async function postDvlaTestNotification(
  ctx: PostDvlaNotificationContext,
  auth: string,
  linkingId: string,
): Promise<void> {
  const { integrations, logger } = ctx;

  const response = await integrations.dvlaTestNotification({
    body: {},
    headers: { auth: auth },
    path: `/${linkingId}`,
  });

  if (!response.ok) {
    logger.error("Failed to get send test notification to DVLA", {
      status: response.error.status,
      errorBody: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }
}
