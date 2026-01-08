import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handler } from "./get";

describe("createLambdaHandler", () => {
  const mockContext = {
    getRemainingTimeInMillis: () => 1000,
  } as unknown as Context;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Hello World handler", () => {
    it("GET /example returns Hello, World!", async () => {
      const event = {} as APIGatewayProxyEvent;

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ message: "Hello, World!" });
    });
  });
});
