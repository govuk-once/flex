import { createUserId, it } from "@flex/testing";
import type { CreateServiceIdentityLinkRequest } from "@schemas/identity";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("POST /v1/identity/:service/:id", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");

  const service = "test-service";
  const serviceId = "test-service-id";
  const endpoint = `/identity/${service}/${serviceId}`;

  const userId = createUserId("test-pairwise-id");

  const body: CreateServiceIdentityLinkRequest = { appId: userId };

  const event = {
    httpMethod: "POST",
    path: endpoint,
    pathParameters: { service, id: serviceId },
  };

  describe("response", () => {
    it("returns 201 when a new service identity is linked", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .post(`/gateways/udp/v1/identity/${service}/${serviceId}`, body)
        .reply(201);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({ statusCode: 201, body: "" });
    });
  });

  describe("errors", () => {
    it("returns 502 when identity link fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .post(`/gateways/udp/v1/identity/${service}/${serviceId}`, body)
        .reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({ statusCode: 502, body: "" });
    });
  });
});
