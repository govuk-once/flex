import createHttpError from "http-errors";
import { z } from "zod";

import { route } from "../../../../domain.config";
import { NotificationSchema } from "../../../schemas/notification";

export const handler = route("GET /v1/notifications", async (ctx) => {
  const pushIdResponse = await ctx.integrations.udpGetPushId({
    headers: { "User-Id": ctx.auth.pairwiseId },
  });

  if (!pushIdResponse.ok) {
    ctx.logger.error("Failed to retrieve push Id from UDP", {
      status: pushIdResponse.error.status,
    });
    throw new createHttpError.InternalServerError();
  }

  const pushId = pushIdResponse.data.pushId;

  const url = new URL(
    `${ctx.resources.unsFlexPrivateGatewayUrl.replace(/\/$/, "")}/notifications`,
  );
  url.searchParams.set("externalUserID", pushId);

  const response = await fetch(url.toString());

  if (!response.ok) {
    ctx.logger.error("Returned failed response fetching notifications", {
      status: response.status,
    });
    throw new createHttpError.InternalServerError();
  }

  const rawBody = (await response.json()) as unknown;
  const parsed = z.array(NotificationSchema).safeParse(rawBody);

  if (!parsed.success) {
    ctx.logger.error("Unexpected response", {
      error: parsed.error.message,
    });
    throw new createHttpError.InternalServerError();
  }

  return {
    status: 200,
    data: parsed.data.map((n) => ({
      NotificationID: n.NotificationID,
      NotificationTitle: n.NotificationTitle,
      NotificationBody: n.NotificationBody,
      MessageTitle: n.MessageTitle,
      MessageBody: n.MessageBody,
      DispatchedDateTime: n.DispatchedDateTime,
      Status: n.Status,
    })),
  };
});
