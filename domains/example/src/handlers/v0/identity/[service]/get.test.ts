import { it } from "@flex/testing";
import { createUserId } from "@utils/parser";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v0/identity/:service", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");

  const service = "test-service";
  const userId = createUserId("test-pairwise-id");

  const endpoint = `/identity/${service}`;
  const event = {
    httpMethod: "GET",
    path: endpoint,
    pathParameters: { service },
  };

  const existingIdentity = {
    serviceId: "existing-id",
    serviceName: "test-service",
  };

  describe("response", () => {
    it("returns 200 with linked set to true when identity exists", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get(`/gateways/udp/v1/identity/${service}`)
        .matchHeader("User-Id", userId)
        .reply(200, existingIdentity);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({ linked: true });
    });

    it("returns 200 with linked set to false when identity does not exist", async ({
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
    it("returns 502 when upstream fails", async ({
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
