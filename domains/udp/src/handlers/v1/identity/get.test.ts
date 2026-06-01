import { it } from "@flex/testing";
import status from "http-status";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/identity", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");

  const endpoint = "/identity";

  const event = {
    httpMethod: "GET",
    path: endpoint,
  };

  describe("response", () => {
    it("returns 200 and the list of tracking services when user identity records exist", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const mockUdpResponse = {
        data: {
          services: ["dvla", "hmrc"],
        },
      };

      api
        .get("/gateways/udp/v1/identities/test-pairwise-id")
        .reply(status.OK, mockUdpResponse);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({
        statusCode: status.OK,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mockUdpResponse.data),
      });
    });

    it("returns 204 when no identity profile is found for the user (NOT_FOUND state)", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/udp/v1/identities/test-pairwise-id")
        .reply(status.NOT_FOUND);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({
        statusCode: status.NO_CONTENT,
        body: "",
      });
    });
  });

  describe("errors", () => {
    it("returns 502 when the downstream platform returns an unexpected internal error", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api
        .get("/gateways/udp/v1/identities/test-pairwise-id")
        .reply(status.INTERNAL_SERVER_ERROR);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create(event),
        context.create(),
      );

      expect(result).toStrictEqual({
        statusCode: status.BAD_GATEWAY,
        body: "",
      });
    });
  });
});
