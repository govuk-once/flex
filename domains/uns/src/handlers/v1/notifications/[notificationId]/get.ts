import createHttpError from "http-errors";

import { route } from "../../../../../domain.config";
import { MOCK_NOTIFICATIONS } from "../../../../data/notifications";

export const handler = route(
  "GET /v1/notifications/:notificationId",
  ({ pathParams, logger }) => {
    logger.debug("Fetching notification");

    const { notificationId } = pathParams;

    const notification = MOCK_NOTIFICATIONS.find(
      (n) => n.NotificationID === notificationId,
    );

    if (!notification) {
      throw new createHttpError.NotFound();
    }

    logger.debug("Successful get notification");

    return Promise.resolve({ status: 200, data: notification });
  },
);
