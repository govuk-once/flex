import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("UDP domain", () => {
  const ingressPath = "/1.0/app";
  const endpoint = `${ingressPath}/user`;
  const user = { name: "John Doe" };

  it("rejects request at CloudFront when unauthenticated", async ({
    cloudfront,
  }) => {
    const response = await cloudfront.client.post(endpoint, {
      body: user,
    });

    expect(response.headers.get("apigw-requestid")).toBeNull();
    expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
    expect(response).toMatchObject({
      status: 401,
      statusText: "Unauthorized",
      body: "Unauthorized: no authorization header provided",
    });
  });

  it("rejects request at CloudFront when Bearer token is empty", async ({
    cloudfront,
  }) => {
    const response = await cloudfront.client.post(endpoint, {
      body: user,
      headers: { Authorization: "Bearer " },
    });

    expect(response.headers.get("apigw-requestid")).toBeNull();
    expect(response.headers.get("x-rejected-by")).toBe("cloudfront-function");
    expect(response).toMatchObject({
      status: 401,
      statusText: "Unauthorized",
      body: "Unauthorized: authentication header invalid",
    });
  });

  it.todo("returns a 201 and creates a user", async ({ cloudfront }) => {
    // TODO: Replace with expired test user token
    const token = "todo.valid.token";
    const pairwiseId = "todo.pairwise.id";

    const response = await cloudfront.client.post(endpoint, {
      body: user,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response).toMatchObject({
      status: 201,
      body: {
        message: "User created successfully!",
        userId: pairwiseId,
      },
    });
  });
});
