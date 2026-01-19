import { it, middyRequests } from "@flex/testing";
import { describe, expect } from "vitest";

import { extractUser } from "./extract-user";

describe("extractUser middleware", () => {
  it("extracts the user from the request context", () => {
    const request = middyRequests.authenticated;

    extractUser.before!(request);

    expect(request.event.requestContext.authorizer.lambda.pairwiseId).toBe(
      "test-pairwise-id",
    );
  });

  it("throws an error if the pairwise id is not found", () => {
    const request = middyRequests.unauthenticated;

    expect(() => {
      extractUser.before!(request);
    }).toThrow("Pairwise ID not found");
  });
});
