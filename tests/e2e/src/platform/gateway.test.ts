import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("UDP gateway", () => {
  const ingressPath = "/app";
  const domainVersion = "v1";
  const endpoint = `${ingressPath}/${domainVersion}/user`;
  const token = "todo.valid.token";

  it("POST /user calls the UDP connector via private API", async ({
    cloudfront,
  }) => {
    const response = await cloudfront.client.post(endpoint, {
      body: {},
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    expect(response.headers.get("apigw-requestid")).toBeNull();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      notificationId: expect.any(String) as string,
    });
  });
});
