import createHttpError from "http-errors";

import {
  patchNotificationStatusContext,
  route,
} from "../../../../../../domain.config";
import { deriveExternalUserId } from "../../../../../utils/derive-external-user-id";

export const handler = route(
  "PATCH /v1/notifications/:notificationId/status",
  async ({ pathParams, body, logger }) => {
    const { notificationId } = pathParams;
    const { auth, resources } = patchNotificationStatusContext();
    const externalUserId = deriveExternalUserId(
      auth.pairwiseId,
      resources.unsNotificationSecret,
    );

    const url = new URL(
      `${resources.flexPrivateGatewayUrl.replace(/\/$/, "")}/notifications/${notificationId}`,
    );
    url.searchParams.set("externalUserID", externalUserId);

    const response = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Status: body.Status }),
    });

    if (response.status === 404) {
      throw new createHttpError.NotFound();
    }

    if (!response.ok) {
      logger.error(
        "Fatal error on UNS patch notification",
        { status: response.status },
      );
      throw new createHttpError.InternalServerError();
    }

    return { status: 202 };
  },
);
