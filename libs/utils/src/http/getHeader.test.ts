import { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";

import { getHeader } from "./getHeader";

describe("getHeader", () => {
  it("return the value of the header", () => {
    const event = {
      headers: { "x-test": "test" },
    } as unknown as APIGatewayProxyEvent;
    expect(getHeader(event, "x-test")).toBe("test");
  });

  it("return undefined if the header is not found", () => {
    const event = {
      headers: { "x-test": "test" },
    } as unknown as APIGatewayProxyEvent;
    expect(getHeader(event, "x-not-found")).toBeUndefined();
  });

  it("return the value of the header in lowercase", () => {
    const event = {
      headers: { "x-test": "test" },
    } as unknown as APIGatewayProxyEvent;
    expect(getHeader(event, "X-TEST")).toBe("test");
  });

  it("ignores case of the header name", () => {
    const event = {
      headers: { "x-test": "test" },
    } as unknown as APIGatewayProxyEvent;
    expect(getHeader(event, "x-test")).toBe("test");
  });
});
