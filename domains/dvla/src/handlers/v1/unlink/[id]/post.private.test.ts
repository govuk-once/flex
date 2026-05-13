import { it } from "@flex/testing";
import status from "http-status";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./post.private";

describe("POST /v1/unlink [private]", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const testAuthToken = "test-id-token";
  const testId = "service-123-abc";

  const mockAuthSuccess = () =>
    api.get("/gateways/dvla/v1/authenticate").reply(status.OK, {
      "id-token": testAuthToken,
      apiKeyExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
      passwordExpiry: "2030-01-01T00:00:00Z", // pragma: allowlist secret
    });

  it("returns 200 and success data when unlinking is successful", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    mockAuthSuccess();

    const mockUnlinkResponse = { success: true };

    api
      .post(`/gateways/dvla/v1/unlink-user/${testId}`)
      .matchHeader("auth", testAuthToken)
      .reply(status.OK, mockUnlinkResponse);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        pathParameters: { id: testId },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(status.OK);
    expect(JSON.parse(result.body)).toStrictEqual(mockUnlinkResponse);
  });

  describe("Error scenarios", () => {
    it("returns 502 if the DVLA authentication service fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      api.get("/gateways/dvla/v1/authenticate").reply(status.UNAUTHORIZED);

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          pathParameters: { id: testId },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_GATEWAY);
    });

    it("returns 502 if the dvlaUnlinkUser integration fails", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockAuthSuccess();

      api
        .post(`/gateways/dvla/v1/unlink-user/${testId}`)
        .reply(status.INTERNAL_SERVER_ERROR, { message: "Internal Error" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          pathParameters: { id: testId },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_GATEWAY);
    });

    it("returns 400 if integration returns 400", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      mockAuthSuccess();

      api
        .post(`/gateways/dvla/v1/unlink-user/${testId}`)
        .reply(status.BAD_REQUEST, { message: "Bad Request" });

      const result = await handler(
        privateGatewayEventWithAuthorizer.create({
          pathParameters: { id: testId },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(status.BAD_REQUEST);
    });
  });
});
