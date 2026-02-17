import { it } from "@flex/testing/e2e";
import { describe, expect } from "vitest";

describe("private gateway", () => {
  it("rejects direct access from public internet (403 Forbidden)", async (
    { privateGateway },
  ) => {
    // Private API Gateway is only reachable from within the VPC via the
    // interface endpoint. Requests from the public internet receive 403 Forbidden.
    const response = await privateGateway.client.get("/domains");

    expect(response.status).toBe(403);
  });
});
