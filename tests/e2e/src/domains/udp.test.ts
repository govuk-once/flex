import { describe, expect, it } from "vitest";

import { e2eEnv } from "../setup";

describe("UDP domain", () => {
  const apiGatewayUrl = e2eEnv.API_GATEWAY_URL;
  const pairwiseId = "test-pairwise-id";

  describe("POST /post-login", () => {
    it("returns a 201 and creates a user", async () => {
      const url = `${apiGatewayUrl}/post-login`;
      const token = "eyJy1";
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify({ name: "John Doe" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await response.json();
      expect(response.status).toBe(201);
      expect(body).toEqual({
        message: "User created successfully!",
        userId: pairwiseId,
      });
    });
  });
});
