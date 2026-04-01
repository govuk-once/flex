import createHttpError from "http-errors";

import {
  getNotificationByIdContext,
  route,
} from "../../../../../domain.config";
import { NotificationSchema } from "../../../../schemas/notification";
import { deriveExternalUserId } from "../../../../utils/derive-external-user-id";

export const handler = route(
  "GET /v1/notifications/:notificationId",
  async ({ pathParams, logger }) => {
    const { notificationId } = pathParams;
    const { auth, resources } = getNotificationByIdContext();
    const externalUserId = deriveExternalUserId(
      auth.pairwiseId,
      resources.unsNotificationSecret,
    );

    const url = new URL(
      `${resources.flexPrivateGatewayUrl.replace(/\/$/, "")}/notifications/${notificationId}`,
    );
    url.searchParams.set("externalUserID", externalUserId);

    const response = await fetch(url.toString());

    if (response.status === 404) {
      throw new createHttpError.NotFound();
    }

    if (!response.ok) {
      logger.error("Fatal error on calling UNS", {
        status: response.status,
      });
      throw new createHttpError.InternalServerError();
    }

    const rawBody: unknown = await response.json();
    const parsed = NotificationSchema.safeParse(rawBody);

    if (!parsed.success) {
      logger.error("Unexpected notification response shape", {
        error: parsed.error.message,
      });
      throw new createHttpError.InternalServerError();
    }

    return {
      status: 200,
      data: {
        NotificationID: parsed.data.NotificationID,
        NotificationTitle: parsed.data.NotificationTitle,
        NotificationBody: parsed.data.NotificationBody,
        MessageTitle: parsed.data.MessageTitle,
        MessageBody: parsed.data.MessageBody,
        DispatchedDateTime: parsed.data.DispatchedDateTime,
        Status: parsed.data.Status,
      },
    };
  },
);
