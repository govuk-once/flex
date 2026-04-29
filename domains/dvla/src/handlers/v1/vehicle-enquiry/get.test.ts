import { it } from "@flex/testing";
import status from "http-status";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/vehicle-enquiry", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const testRegistration = "AA11ABC";

  it("returns 200 and vehicle data on success", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    const mockVehicleData = {
      registrationNumber: testRegistration,
      make: "TOYOTA",
      colour: "BLUE",
      fuelType: "PETROL",
      taxStatus: "Taxed",
    };

    api
      .get("/gateways/dvla/v1/vehicle-enquiry")
      .query({ registrationNumber: testRegistration })
      .reply(status.OK, mockVehicleData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        queryStringParameters: { registrationNumber: testRegistration },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(status.OK);
    expect(JSON.parse(result.body)).toStrictEqual(mockVehicleData);
  });

  describe("Error scenarios", () => {
    it("returns 400 when DVLA returns a Bad Request", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/dvla/v1/vehicle-enquiry")
        .query(true)
        .reply(status.BAD_REQUEST, { message: "Invalid VRM" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          queryStringParameters: { registrationNumber: "INVALID" },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_REQUEST);
    });

    it("returns 404 when vehicle is not found in DVLA records", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/dvla/v1/vehicle-enquiry")
        .query(true)
        .reply(status.NOT_FOUND, { message: "Vehicle not found" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          queryStringParameters: { registrationNumber: "NOTFOUND" },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(status.NOT_FOUND);
    });

    it("returns 429 when DVLA rate limit is exceeded", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/dvla/v1/vehicle-enquiry")
        .query(true)
        .reply(status.TOO_MANY_REQUESTS);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          queryStringParameters: { registrationNumber: testRegistration },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(status.TOO_MANY_REQUESTS);
    });

    it("returns 502 as default for other upstream errors (e.g. 500)", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/dvla/v1/vehicle-enquiry")
        .query(true)
        .reply(status.INTERNAL_SERVER_ERROR);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          queryStringParameters: { registrationNumber: testRegistration },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_GATEWAY);
    });
  });
});
