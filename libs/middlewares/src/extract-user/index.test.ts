import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { extractUser } from ".";

describe("extractUser middleware", () => {
  it("extracts the user from the request context", ({ middy }) => {
    const request = middy.authenticated();

    extractUser.before?.(request);

    expect(request.event.requestContext.authorizer.pairwiseId).toBe(
      "test-pairwise-id",
    );
  });

  it("throws an error if the pairwise id is not found", ({ middy }) => {
    const request = middy.unauthenticated();

    expect(() => {
      extractUser.before?.(request);
    }).toThrow("Pairwise ID not found");
  });
});
