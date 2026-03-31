import { it } from "@flex/testing";
import nock from "nock";
import { describe, expect } from "vitest";

import type { LocalAuthority } from "../../../../schemas/local-authority";
import { handler } from "./post.private";

const validBody: LocalAuthority = {
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

describe("POST /v1/local-council/:id [private]", () => {
  const api = nock("https://execute-api.eu-west-2.amazonaws.com");
  const id = "test-uuid-123";

  it("returns 200 when local authority is saved", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    api.post(`/gateways/udp/v1/local-council/${id}`, validBody).reply(200);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "POST",
        pathParameters: { id },
        body: JSON.stringify(validBody),
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(200);
  });

  it("returns 502 when saving fails", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    api.post(`/gateways/udp/v1/local-council/${id}`, validBody).reply(500);

    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "POST",
        pathParameters: { id },
        body: JSON.stringify(validBody),
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(502);
  });

  it("returns 400 when body is invalid", async ({
    context,
    privateGatewayEventWithAuthorizer,
  }) => {
    const result = await handler(
      privateGatewayEventWithAuthorizer.create({
        httpMethod: "POST",
        pathParameters: { id },
        body: JSON.stringify({ invalid: true }),
      }),
      context.create(),
    );

    expect(result.statusCode).toBe(400);
  });
});
