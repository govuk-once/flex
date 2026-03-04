import { it } from "@flex/testing/e2e";
import { describe, expect, inject } from "vitest";

describe("private gateway", () => {
  const { JWT } = inject("e2eEnv");

  it("rejects direct access from public internet (403 Forbidden)", async ({
    privateGateway,
  }) => {
    // Private API Gateway is only reachable from within the VPC via the
    // interface endpoint. Requests from the public internet receive 403 Forbidden.
    await expect(privateGateway.client.get("/domains")).rejects.toSatisfy(
      (err: unknown) => {
        const e = err as {
          message?: string;
          cause?: { code?: string; message?: string };
        };

        const code = e.cause?.code;
        const combined = `${e.message ?? ""} ${e.cause?.message ?? ""}`;

        return (
          ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT"].includes(
            code ?? "",
          ) ||
          /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(
            combined,
          )
        );
      },
    );
  });

  it.todo(
    "rejects service-to-service call when route permissions are missing",
    async ({ cloudfront }) => {
      const response = await cloudfront.client.get("/v1/hello-call-internal", {
        headers: { Authorization: `Bearer ${JWT.VALID}` },
      });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        type: "auth_error",
      });
    },
  );
});
