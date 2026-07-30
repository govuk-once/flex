import { route } from "@domain";
import type { UserId } from "@flex/utils";
import createHttpError from "http-errors";

export const handler = route(
  "POST /v1/groups",
  async ({ auth, integrations, body,logger }) => {
    const userId = auth.pairwiseId as UserId;

    const pushIdResponse = await integrations.udpGetPushId({
      headers: { "User-Id": userId },
    });

    if (!pushIdResponse.ok) {
      logger.error("Call to get push id failed for post groups endpoint", pushIdResponse.error.message,
      );

      throw new createHttpError.BadGateway();
    }

    const { pushId } = pushIdResponse.data;

    const request = body.map(({ Type, ...group }) => group)

    const response = await integrations.unsPostGroups({
      query: { pushID: pushId },
      body: request
    });

    if (!response.ok) {
      logger.error( "Call to post  groups failed", response.error.message );
      throw new createHttpError.BadGateway();
    }

    const groups = response.data.map((group) => ({
      ...group,
      Type: "NOTIFICATION" as const,
    }));

    return {
      status: 200,
      data: groups,
    };
  },
);