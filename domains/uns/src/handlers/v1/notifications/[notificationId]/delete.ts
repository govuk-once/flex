import createHttpError from "http-errors";

import { deleteNotificationContext, route } from "../../../../../domain.config";
import { deriveExternalUserId } from "../../../../utils/derive-external-user-id";

export const handler = route(
  "DELETE /v1/notifications/:notificationId",
  async ({ pathParams, logger }) => {
    const { notificationId } = pathParams;
    const { auth, resources } = deleteNotificationContext();
    const externalUserId = deriveExternalUserId(
      auth.pairwiseId,
      resources.unsNotificationSecret,
    );

    const url = new URL(
      `${resources.flexPrivateGatewayUrl.replace(/\/$/, "")}/notifications/${notificationId}`,
    );
    url.searchParams.set("externalUserID", externalUserId);

    const response = await fetch(url.toString(), {
      method: "DELETE",
    });

    if (response.status === 404) {
      throw new createHttpError.NotFound();
    }

    if (!response.ok) {
      logger.error("Fatal error on UNS delete notification", {
        status: response.status,
      });
      throw new createHttpError.InternalServerError();
    }

    return { status: 204 };
  },
);
