import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v0/resources/runtim", () => {
  const endpoint = "/resources/runtim";
  const params = { privateGatewaysRoot: "param-value" };

  describe("response", () => {
    it("returns 200 with resolved resources", async ({
      context,
      privateGatewayEventWithAuthorizer,
    }) => {
      const result = await handler(
        privateGatewayEventWithAuthorizer.get(endpoint),
        context.withParams(params).create(),
      );

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toStrictEqual({
        ssm: { param: expect.any(Number) as number },
      });
    });
  });
});
