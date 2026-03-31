import createHttpError from "http-errors";

import { route } from "../../../../../../domain.config";
import { MOCK_NOTIFICATIONS } from "../../../../../data/notifications";

export const handler = route(
  "PATCH /v1/notifications/:pushId/status",
  ({ pathParams, body, logger }) => {
    logger.debug("Patch notification");

    const { pushId } = pathParams;

    const notification = MOCK_NOTIFICATIONS.find((n) => n.PushId === pushId);

    if (!notification) {
      throw new createHttpError.NotFound();
    }

    logger.debug("Updating notification status", {
      pushId,
      status: body.Status,
    });

    return Promise.resolve({ status: 202 });
  },
);
