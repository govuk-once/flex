import { createUserId, it } from "@flex/testing";
import type { GetServiceIdentityLinkResponse } from "@schemas/identity";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./delete";

describe("DELETE /v1/identity/:service", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");

  const service = "test-service";
  const serviceId = "test-service-id";
  const endpoint = `/identity/${service}/${serviceId}`;

  const userId = createUserId("test-pairwise-id");

  const foundServiceIdentityLink: GetServiceIdentityLinkResponse = {
    serviceId: "existing-service-id",
    serviceName: "existing-service-name",
  };

  const event = {
    httpMethod: "DELETE",
    path: endpoint,
    pathParameters: { service, id: serviceId },
  };

  describe("response", () => {
    it("returns 204 when an existing service identity is unlinked", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get(`/gateways/udp/v1/identity/${service}`)
        .matchHeader("User-Id", userId)
        .reply(200, foundServiceIdentityLink);

      api
        .delete(
          `/gateways/udp/v1/identity/${foundServiceIdentityLink.serviceName}/${foundServiceIdentityLink.serviceId}`,
        )
        .reply(204);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({ statusCode: 204, body: "" });
    });
  });

  describe("errors", () => {
    it("returns 404 when service identity link does not exist", async ({
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

      expect(result).toStrictEqual({ statusCode: 404, body: "" });
    });

    it("returns 502 when retrieving existing service identity link fails", async ({
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

      expect(result).toStrictEqual({ statusCode: 502, body: "" });
    });

    it("returns 502 when unlinking service identity fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get(`/gateways/udp/v1/identity/${service}`)
        .matchHeader("User-Id", userId)
        .reply(200, foundServiceIdentityLink);

      api
        .delete(
          `/gateways/udp/v1/identity/${foundServiceIdentityLink.serviceName}/${foundServiceIdentityLink.serviceId}`,
        )
        .reply(500);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({ statusCode: 502, body: "" });
    });
  });
});
