import { createUserId, it } from "@flex/testing";
import type {
  CreateServiceIdentityLinkRequest,
  GetServiceIdentityLinkResponse,
} from "@schemas/identity";
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
    it("returns 201 when a new service identity is linked (none existed)", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      // 1. Initial check returns 404 (not linked)
      api.get(`/gateways/udp/v1/identity/${service}`).reply(404);

      // 2. Then create the new link
      api
        .post(`/gateways/udp/v1/identity/${service}/${serviceId}`, body)
        .reply(201);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({ statusCode: 201, body: "" });
    });

    it("returns 204 when the identity is already linked with the same ID", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const existingLink: GetServiceIdentityLinkResponse = {
        serviceId: serviceId, // Same ID as requested
        serviceName: service,
      };

      // 1. Initial check finds existing link
      api.get(`/gateways/udp/v1/identity/${service}`).reply(200, existingLink);

      // No POST or DELETE should occur

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({ statusCode: 204, body: "" });
    });

    it("returns 201 after unlinking an old ID if a different ID exists", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const oldId = "old-id";
      const existingLink: GetServiceIdentityLinkResponse = {
        serviceId: oldId,
        serviceName: service,
      };

      // 1. Initial check finds an OLD ID
      api.get(`/gateways/udp/v1/identity/${service}`).reply(200, existingLink);

      // 2. Logic should trigger a DELETE for the old link
      api.delete(`/gateways/udp/v1/identity/${service}/${oldId}`).reply(204);

      // 3. Then create the NEW link
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
    it("returns 502 when the initial check fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      // Logic fails at the first step
      api.get(`/gateways/udp/v1/identity/${service}`).reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({ statusCode: 502, body: "" });
    });

    it("returns 502 when the creation (post) fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get(`/gateways/udp/v1/identity/${service}`).reply(404);
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
