import { route } from "@domain";
import type { UserId } from "@flex/utils";
import { getUserGroups } from "@services/udp";
import createHttpError from "http-errors";

import { GroupType } from "../../../types";

export const handler = route(
  "POST /v1/groups",
  async ({ auth, integrations, body, logger }) => {
    const userId = auth.pairwiseId as UserId;

    const pushIdResponse = await integrations.udpGetPushId({
      headers: { "User-Id": userId },
    });

    if (!pushIdResponse.ok) {
      logger.error(
        "Call to get push id failed for post groups endpoint",
        pushIdResponse.error.message,
      );

      throw new createHttpError.BadGateway();
    }

    const { pushId } = pushIdResponse.data;

    const currentUserGroups = await getUserGroups(userId);

    const unsRequest = body.map(({ Type: _type, ...group }) => group);

    const unsResponse = await integrations.unsPostGroups({
      query: { pushID: pushId },
      body: unsRequest,
    });

    if (!unsResponse.ok) {
      logger.error("Call to uns post groups failed", unsResponse.error.message);
      throw new createHttpError.BadGateway();
    }

    const notificationGroups = unsResponse.data.map((group) => ({
      ...group,
      Type: GroupType.NOTIFICATION,
    }));

    const nonNotificationGroups = currentUserGroups.filter(
      (group) => group.Type !== GroupType.NOTIFICATION,
    );

    const groups = [...nonNotificationGroups, ...notificationGroups];

    const udpResponse = await integrations.udpPostGroups({
      headers: { "requesting-service-user-id": userId },
      body: groups,
    });

    if (!udpResponse.ok) {
      logger.error("Call to udp post groups failed", udpResponse.error.message);
      throw new createHttpError.BadGateway();
    }

    return {
      status: 200,
      data: groups,
    };
  },
);
