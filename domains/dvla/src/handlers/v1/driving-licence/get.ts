import { route, routeContext } from "@domain";
import createHttpError from "http-errors";
import { status } from "http-status";

import { ViewDriverResponse } from "../../../schemas/driversLicence";

const context = routeContext<"GET /v1/driving-licence">;

export const handler = route("GET /v1/driving-licence", async () => {
  const auth = await getDvlaAuthToken();
  const userLinkingId = "";

  return {
    status: status.OK,
    data: await getDvlaLicence(
      auth,
      await getDvlaLicenceKey(auth, userLinkingId),
    ),
  };
});

async function getDvlaAuthToken(): Promise<string> {
  const { integrations, logger } = context();

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
  auth: string,
  linkingId: string,
): Promise<string> {
  const { integrations, logger } = context();

  const response = await integrations.dvlaRetrieveCustomer({
    path: `/${linkingId}`,
    headers: { Authorization: auth },
  });

  if (!response.ok) {
    logger.error("Failed to get userRef with DVLA", {
      status: response.error.status,
      errorBody: response.error.body,
    });

    throw new createHttpError.BadGateway();
  }

  const drivingLicenceProduct = response.data.customer.products?.find(
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
  auth: string,
  productKey: string,
): Promise<ViewDriverResponse> {
  const { integrations, logger } = context();

  const response = await integrations.dvlaRetrieveLicence({
    path: `/${productKey}`,
    headers: { Authorization: auth },
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
