import { it } from "@flex/testing";
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
      .matchHeader("registrationNumber", testRegistration)
      .reply(200, mockVehicleData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        headers: { registrationNumber: testRegistration },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(mockVehicleData);
  });

  describe("Error scenarios", () => {
    it("returns 400 when DVLA returns a Bad Request", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/dvla/v1/vehicle-enquiry")
        .reply(400, { message: "Invalid VRM" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          headers: { registrationNumber: "INVALID" },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(400);
    });

    it("returns 404 when vehicle is not found in DVLA records", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/dvla/v1/vehicle-enquiry")
        .reply(404, { message: "Vehicle not found" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          headers: { registrationNumber: "NOTFOUND" },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(404);
    });

    it("returns 429 when DVLA rate limit is exceeded", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get("/gateways/dvla/v1/vehicle-enquiry").reply(429);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          headers: { registrationNumber: testRegistration },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(429);
    });

    it("returns 502 as default for other upstream errors (e.g. 500)", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get("/gateways/dvla/v1/vehicle-enquiry").reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          headers: { registrationNumber: testRegistration },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });
  });
});
