import { createUserId, it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("POST /v0/identity/:service/:id", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");

  const userId = createUserId("test-pairwise-id");

  const service = "test-service";
  const serviceId = "test-service-id";
  const endpoint = `/identity/${service}/${serviceId}`;

  it("returns 201 when identity is linked successfully", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    api
      .post(`/gateways/udp/v1/identity/${service}/${serviceId}`, {
        appId: userId,
      })
      .reply(201);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        path: endpoint,
        body: "{}",
        pathParameters: { service, id: serviceId },
      }),
      context.create(),
    );

    expect(result).toStrictEqual({ statusCode: 201, body: "" });
  });

  it("returns 502 when identity linking fails", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    api
      .post(`/gateways/udp/v1/identity/${service}/${serviceId}`, {
        appId: userId,
      })
      .reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        path: endpoint,
        body: "{}",
        pathParameters: { service, id: serviceId },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(502);
  });
});
