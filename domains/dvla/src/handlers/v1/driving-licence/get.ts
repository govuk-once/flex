import { config, route } from "@domain";
import { InferRouteContext } from "@flex/sdk";
import createHttpError from "http-errors";
import { status } from "http-status";

import { ViewDriverResponse } from "../../../schemas/driversLicence";

type GetDvlaLicenceContext = InferRouteContext<
  typeof config,
  "GET /v1/driving-licence"
>;

export const handler = route("GET /v1/driving-licence", async (ctx) => {
  const [userLinkingId, auth] = await Promise.all([
    getUserLinkingId(ctx),
    getDvlaAuthToken(ctx),
  ]);

  const licenceKey = await getDvlaLicenceKey(ctx, auth, userLinkingId);
  const data = await getDvlaLicence(ctx, auth, licenceKey);

  return {
    status: status.OK,
    data,
  };
});

async function getUserLinkingId(ctx: GetDvlaLicenceContext): Promise<string> {
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

async function getDvlaAuthToken(ctx: GetDvlaLicenceContext): Promise<string> {
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

async function getDvlaLicenceKey(
  ctx: GetDvlaLicenceContext,
  auth: string,
  linkingId: string,
): Promise<string> {
  const { integrations, logger } = ctx;

  const response = await integrations.dvlaRetrieveCustomer({
    path: `/${linkingId}`,
    headers: { auth: auth },
  });

  if (!response.ok) {
    logger.error("Failed to get userRef with DVLA", {
      status: response.error.status,
      errorBody: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  const drivingLicenceProduct = response.data.customer.products.find(
    (p) => p.productType === "Driving Licence",
  );

  const productKey = drivingLicenceProduct?.productKey;

  if (!productKey) {
    logger.error("No Driving Licence product key found in DVLA reference", {
      customerId: response.data.customer.customerId,
    });
    throw new createHttpError.UnprocessableEntity(
      "Driving Licence record missing",
    );
  }

  return productKey;
}

async function getDvlaLicence(
  ctx: GetDvlaLicenceContext,
  auth: string,
  productKey: string,
): Promise<ViewDriverResponse> {
  const { integrations, logger } = ctx;

  const response = await integrations.dvlaRetrieveLicence({
    path: `/${productKey}`,
    headers: { auth: auth },
  });

  if (!response.ok) {
    logger.error("Failed to get licence with DVLA", {
      status: response.error.status,
      errorBody: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  return response.data;
}
