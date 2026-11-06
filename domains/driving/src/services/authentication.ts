import { config } from "@domain";
import type { InferRouteContext } from "@flex/sdk";
import createHttpError from "http-errors";

type DrivingContext = InferRouteContext<
  typeof config,
  "GET /v1/vehicle/mot/:reg"
>;

export async function getDvsaAuthToken(ctx: DrivingContext): Promise<string> {
  const { integrations, logger } = ctx;

  const response = await integrations.dvsaAuthenticate({});

  if (!response.ok) {
    logger.error("Failed to authenticate with DVSA", {
      status: response.error.status,
      errorBody: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  return response.data.access_token;
}
