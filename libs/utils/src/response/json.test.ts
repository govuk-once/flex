import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";

import { jsonResponse } from "./json";

describe("jsonResponse", () => {
  it("returns status code, stringified body, and JSON content-type header", () => {
    const result = jsonResponse(200, { ok: true });
    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
      headers: { "Content-Type": "application/json" },
    });
  });

  it("returns undefined body when no body is provided", () => {
    const result = jsonResponse(204) as APIGatewayProxyStructuredResultV2;
    expect(result.body).toBeUndefined();
  });

  it("always sets Content-Type header", () => {
    expect(
      (jsonResponse(500) as APIGatewayProxyStructuredResultV2).headers,
    ).toEqual({
      "Content-Type": "application/json",
    });
  });

  it("passes through the status code", () => {
    expect(
      (
        jsonResponse(404, {
          message: "Not Found",
        }) as APIGatewayProxyStructuredResultV2
      ).statusCode,
    ).toBe(404);
  });
});
