import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { getPushId } from "@utils/get-push-id";
import status from "http-status";

export const handler = route(
  "GET /v1/users/push-id [private]",
  // eslint-disable-next-line @typescript-eslint/require-await
  async ({ headers, resources }) => {
    // TODO: SDK auth alias
    const userId = headers.userId as UserId;
    const pushId = getPushId(userId, resources.udpNotificationSecret);

    return {
      status: status.OK,
      data: { pushId },
    };
  },
);
