import { describe, expect, inject, it } from "vitest";

describe("public gateway", () => {
  it("rejects direct execute-api access (403 Forbidden)", async () => {
    // The execute-api endpoint is disabled (disableExecuteApiEndpoint: true).
    // All public traffic must go through CloudFront, which enforces TLS 1.2.
    // Direct requests to the execute-api URL should be blocked by AWS.
    const { FLEX_PUBLIC_EXECUTE_API_URL } = inject("e2eEnv");

    const response = await fetch(`${FLEX_PUBLIC_EXECUTE_API_URL}/health`);

    expect(response.status).toBe(403);
  });
});
