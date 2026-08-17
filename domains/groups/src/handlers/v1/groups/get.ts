import { route } from "@domain";
import type { UserId } from "@flex/utils";
import createHttpError from "http-errors";

import { GroupType } from "../../../types";

export const handler = route(
  "GET /v1/groups",
  async ({ auth, integrations, logger }) => {
    const userId = auth.pairwiseId as UserId;

    const pushIdResponse = await integrations.udpGetPushId({
      headers: { "User-Id": userId },
    });

    if (!pushIdResponse.ok) {
      logger.error(
        "Call to get push id failed for get groups endpoint",
        pushIdResponse.error.message,
      );

      throw new createHttpError.BadGateway();
    }

    const { pushId } = pushIdResponse.data;

    const response = await integrations.unsGetGroups({
      query: { pushID: pushId },
    });

    if (!response.ok) {
      logger.error("Call to get groups failed", response.error.message);
      throw new createHttpError.BadGateway();
    }

    const groups = response.data.map((group) => ({
      ...group,
      Type: GroupType.NOTIFICATION,
    }));

    return {
      status: 200,
      data: groups,
    };
  },
);
