import { describe, expect, it } from "vitest";

import { e2eEnv } from "./setup";

/**
 * E2E test for the API Gateway JWT authorizer
 *
 * This test verifies that the API Gateway JWT authorizer correctly rejects
 * requests without a valid JWT token.
 */
describe("API Gateway JWT Authorizer E2E", () => {
  const apiGatewayUrl = e2eEnv.API_GATEWAY_URL;

  it("rejects request to /hello endpoint without a valid JWT token", async () => {
    const url = `${apiGatewayUrl}/hello`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Intentionally omitting Authorization header
      },
    });

    // API Gateway with JWT authorizer should return 401 Unauthorized
    // when no Authorization header is provided
    expect(response.status).toBe(401);

    // Verify the response indicates authentication is required
    const responseText = await response.text();
    expect(responseText).toEqual(
      JSON.stringify({
        message: "Unauthorized",
      }),
    );
  });

  it("allows request to /hello endpoint with valid authorization header", async () => {
    const url = `${apiGatewayUrl}/hello`;
    const token = "eyJ9";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    // API Gateway with JWT authorizer should return 401 Unauthorized
    // when an invalid token is provided
    const responseText = await response.text();
    expect(response.status).toBe(200);
    expect(responseText).toEqual("Hello World");
  });
});
