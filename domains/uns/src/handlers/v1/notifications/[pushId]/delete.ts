import createHttpError from "http-errors";

import { route } from "../../../../../domain.config";
import { MOCK_NOTIFICATIONS } from "../../../../data/notifications";

export const handler = route(
  "DELETE /v1/notifications/:pushId",
  ({ pathParams, logger }) => {
    logger.debug("Delete notification");

    const { pushId } = pathParams;

    const notification = MOCK_NOTIFICATIONS.find((n) => n.PushId === pushId);

    if (!notification) {
      throw new createHttpError.NotFound();
    }

    logger.debug("Successful delete notification");

    return Promise.resolve({ status: 204 });
  },
);
