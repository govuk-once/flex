import { createUserId, it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/identity/:service", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");

  const service = "test-service";
  const userId = createUserId("test-pairwise-id");

  const event = {
    pathParameters: { service },
  };

  const foundServiceIdentity = {
    serviceId: "existing-id",
    serviceName: "test-service",
  };

  describe("response", () => {
    it("returns 200 when a service identity exists", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get(`/gateways/udp/v1/identity/${service}`)
        .matchHeader("User-Id", userId)
        .reply(200, foundServiceIdentity);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({ linked: true });
    });

    it("returns 200 with linked false when identity does not exist (404)", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get(`/gateways/udp/v1/identity/${service}`)
        .matchHeader("User-Id", userId)
        .reply(404);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({ linked: false });
    });
  });

  describe("errors", () => {
    it("returns 502 when the upstream service returns a 500", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get(`/gateways/udp/v1/identity/${service}`)
        .matchHeader("User-Id", userId)
        .reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result.statusCode).toBe(502);
    });
  });
});
