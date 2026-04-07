import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import type { LocalAuthority } from "../../../../schemas/local-authority";
import { handler } from "./get.private";

const storedData: LocalAuthority = {
  local_authority: {
    name: "Derbyshire Dales District Council",
    homepage_url: "https://www.derbyshiredales.gov.uk/",
    tier: "district",
    slug: "derbyshire-dales",
    parent: {
      name: "Derbyshire County Council",
      homepage_url: "https://www.derbyshire.gov.uk/",
      tier: "county",
      slug: "derbyshire",
    },
  },
};

describe("GET /v1/local-council/:id [private]", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const id = "test-uuid-123";

  it("returns 200 with local authority data", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    api.get(`/gateways/udp/v1/local-council/${id}`).reply(200, storedData);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "GET",
        pathParameters: { id },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(storedData);
  });

  it("returns 404 when local authority does not exist", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    api.get(`/gateways/udp/v1/local-council/${id}`).reply(404);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "GET",
        pathParameters: { id },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(404);
  });

  it("returns 502 when UDP gateway fails", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    api.get(`/gateways/udp/v1/local-council/${id}`).reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "GET",
        pathParameters: { id },
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(502);
  });
});
