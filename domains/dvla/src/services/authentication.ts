import { config } from "@domain";
import { InferRouteContext } from "@flex/sdk";
import createHttpError from "http-errors";
import { status } from "http-status";

type CommonDvlaContext = InferRouteContext<
  typeof config,
  | "GET /v1/customer-summary"
  | "GET /v1/driver-summary"
  | "GET /v1/driving-licence"
  | "POST /v1/test-notification"
>;

export async function getUserLinkingId(
  ctx: CommonDvlaContext,
): Promise<string> {
  const userLinkingIdResult = await ctx.integrations.udpGetLinkingId({
    path: "/dvla",
    headers: { "User-Id": ctx.auth.pairwiseId },
  });

  if (!userLinkingIdResult.ok) {
    if (userLinkingIdResult.error.status === status.NOT_FOUND) {
      ctx.logger.debug("Service linked for DVLA NotFound");
      throw new createHttpError.NotFound();
    }

    ctx.logger.debug("Call to UDP failed", userLinkingIdResult.error.message);
    throw new createHttpError.BadGateway();
  }

  return userLinkingIdResult.data.serviceId;
}

export async function getDvlaAuthToken(
  ctx: CommonDvlaContext,
): Promise<string> {
  const { integrations, logger } = ctx;

  const response = await integrations.dvlaAuthenticate({});

  if (!response.ok) {
    logger.error("Failed to authenticate with DVLA", {
      status: response.error.status,
      errorBody: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  return response.data["id-token"];
}
