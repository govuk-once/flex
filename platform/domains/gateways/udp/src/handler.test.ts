import { it } from "@flex/testing";
import { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, vi } from "vitest";

import { handler } from "./handler";

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() => Promise.resolve({ AWS_REGION: "eu-west-2" })),
}));

describe("UDP connector handler", () => {
  const baseEvent = {
    version: "2.0",
    routeKey: "POST /gateways/udp",
    rawPath: "/gateways/udp",
    rawQueryString: "",
    headers: {},
    requestContext: {} as unknown,
    isBase64Encoded: false,
  };

  it("returns 200 with the event body", async ({ response, context }) => {
    const event = {
      ...baseEvent,
      body: JSON.stringify({ test: "test" }),
    };

    const result = await handler(
      event as unknown as APIGatewayProxyEvent,
      context.create(),
    );

    expect(result).toEqual(
      response.ok(
        { test: "test" },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
  });
});
