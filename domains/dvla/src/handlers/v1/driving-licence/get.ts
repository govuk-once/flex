import { config, route } from "@domain";
import { InferRouteContext } from "@flex/sdk";
import createHttpError from "http-errors";
import { status } from "http-status";

import { ViewDriverResponse } from "../../../schemas/driversLicence";
import {
  getDvlaAuthToken,
  getUserLinkingId,
} from "../../../services/authentication";

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

async function getDvlaLicenceKey(
  ctx: GetDvlaLicenceContext,
  auth: string,
  linkingId: string,
): Promise<string> {
  const { integrations, logger } = ctx;

  const response = await integrations.dvlaCustomerSummary({
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

  const customer = response.data.customerResponse?.customer;
  const products = customer?.products;

  if (!customer || !products) {
    logger.error("Customer record or products missing from DVLA response", {
      linkingId,
    });
    throw new createHttpError.UnprocessableEntity("Customer record incomplete");
  }

  const drivingLicenceProduct = products.find(
    (p) => p.productType === "Driving Licence",
  );

  const productKey = drivingLicenceProduct?.productKey;

  if (!productKey) {
    logger.error("No Driving Licence product key found in DVLA reference", {
      customerId: customer.customerId,
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
