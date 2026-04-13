import { route } from "@domain";
import { UserId } from "@flex/utils";
import { getPushId } from "@utils";
import status from "http-status";

export const handler = route(
  "GET /v1/users/push-id [private]",
  // eslint-disable-next-line @typescript-eslint/require-await
  async ({ headers, resources }) => {
    const userId = headers.userId as UserId;
    const pushId = getPushId(userId, resources.udpNotificationSecret);

    return {
      status: status.OK,
      data: {
        pushId,
      },
    };
  },
);
