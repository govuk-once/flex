import { describe, expect, it } from "vitest";

import { AuthorizationError } from "./errors";

describe("errors", () => {
  describe("AuthorizationError", () => {
    it("has statusCode 401 with pairwise ID extraction message", () => {
      const error = new AuthorizationError();

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("AuthorizationError");
      expect(error.message).toBe(
        "Failed to extract the pairwise ID from the request context",
      );
    });
  });
});
