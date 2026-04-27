import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v0/headers", () => {
  const endpoint = "/headers";

  describe("request validation", () => {
    it("returns 400 when required header is missing", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint, {
          headers: {
            "x-correlation-id": "correlation-value",
            "x-example-id": "example-value",
          },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toStrictEqual({
        message: "Missing headers: x-request-id",
        headers: ["x-request-id"],
      });
    });
  });

  describe("response", () => {
    it("returns 200 with all headers resolved", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint, {
          headers: {
            "x-request-id": "request-value",
            "x-correlation-id": "correlation-value",
            "x-example-id": "example-value",
          },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({
        correlationId: "correlation-value",
        exampleId: "example-value",
        requestId: "request-value",
      });
    });

    it("returns 200 with optional headers set to null when omitted", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint, {
          headers: { "x-request-id": "request-value" },
        }),
        context.create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({
        correlationId: null,
        exampleId: null,
        requestId: "request-value",
      });
    });
  });
});
