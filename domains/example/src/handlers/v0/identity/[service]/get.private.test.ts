import { it } from "@flex/testing";
import { createUserId } from "@utils/parser";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./get.private";

describe("GET /v0/identity/:service [private]", () => {
  const gateway = nock("https://execute-api.eu-west-2.amazonaws.com");

  const service = "test-service";
  const userId = createUserId("test-user-id");

  const endpoint = `/identity/${service}`;
  const event = {
    httpMethod: "GET",
    path: endpoint,
    headers: { "User-Id": userId },
    pathParameters: { service },
  };

  const existingIdentity = {
    serviceId: "existing-id",
    serviceName: "test-service",
  };

  describe("request validation", () => {
    it("returns 400 when user ID header is missing", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          ...event,
          headers: undefined,
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toStrictEqual({
        headers: ["User-Id"],
        message: "Missing headers: User-Id",
      });
    });
  });

  describe("response", () => {
    it("returns 200 with identity link details", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      gateway
        .get(`/gateways/udp/v1/identity/${service}`)
        .matchHeader("User-Id", userId)
        .reply(200, existingIdentity);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual(existingIdentity);
    });
  });

  describe("errors", () => {
    it("returns 404 when identity does not exist", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      gateway
        .get(`/gateways/udp/v1/identity/${service}`)
        .matchHeader("User-Id", userId)
        .reply(404);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result.statusCode).toBe(404);
    });

    it("returns 502 when upstream fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      gateway
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
