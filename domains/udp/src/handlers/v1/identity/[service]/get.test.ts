import { createUserId, it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/identity/:service", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");

  const service = "test-service";
  const endpoint = `/identity/${service}`;
  const query = { requiredService: service };

  const userId = createUserId("test-pairwise-id");
  const serviceId = "test-service-id";

  const foundServiceIdentity = { serviceId };

  const event = {
    httpMethod: "GET",
    path: endpoint,
    pathParameters: { service },
  };

  describe("response", () => {
    it("returns 200 when a service identity exists", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/udp/v1/identity/exchange")
        .query(query)
        .matchHeader("requesting-service-user-id", userId)
        .matchHeader("User-Id", userId)
        .reply(200, foundServiceIdentity);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(result.headers).toStrictEqual({
        "Content-Type": "application/json",
      });
      expect(JSON.parse(result.body)).toStrictEqual({ linked: true });
    });

    it("returns 200 when a service identity does not exist", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/udp/v1/identity/exchange")
        .query(query)
        .matchHeader("requesting-service-user-id", userId)
        .matchHeader("User-Id", userId)
        .reply(404);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(result.headers).toStrictEqual({
        "Content-Type": "application/json",
      });
      expect(JSON.parse(result.body)).toStrictEqual({ linked: false });
    });
  });

  describe("errors", () => {
    it("returns 502 when service identity lookup fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/udp/v1/identity/exchange")
        .query(query)
        .matchHeader("requesting-service-user-id", userId)
        .matchHeader("User-Id", userId)
        .reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({ statusCode: 502, body: "" });
    });
  });
});
