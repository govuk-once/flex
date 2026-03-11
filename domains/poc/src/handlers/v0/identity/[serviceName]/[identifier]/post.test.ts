import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("POST /v0/identity/:serviceName/:identifier", () => {
  const gateway = nock("https://execute-api.eu-west-2.amazonaws.com");
  const endpoint = "/identity";

  const serviceName = "test-service";
  const identifier = "test-id";

  it("returns 201 when identity is linked successfully", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    gateway
      .post(`/gateways/udp/v1/identity/${serviceName}/${identifier}`, {
        appId: "test-pairwise-id",
      })
      .reply(201);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        path: endpoint,
        body: "{}",
        pathParameters: { serviceName, identifier },
      }),
      context.create(),
    );

    expect(result).toStrictEqual({ statusCode: 201, body: "" });
  });

  it("returns 500 when identity linking fails", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    gateway.post(`/gateways/udp/v1/identity/test-service/test-id`).reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        path: endpoint,
        body: "{}",
        pathParameters: { serviceName, identifier },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(500);
  });
});
