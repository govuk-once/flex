import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { HeaderValidationError, RequestBodyParseError } from "./errors";

describe("errors", () => {
  describe("HeaderValidationError", () => {
    it("has statusCode 400 with comma-separated list of missing headers", () => {
      const error = new HeaderValidationError(["test-header"]);

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("HeaderValidationError");
      expect(error.message).toBe("Missing headers: test-header");
      expect(error.headers).toStrictEqual(["test-header"]);
    });
  });

  describe("RequestBodyParseError", () => {
    it("has statusCode 400 with custom message", () => {
      const error = new RequestBodyParseError("Failed to parse request body");

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("RequestBodyParseError");
      expect(error.message).toBe("Failed to parse request body");
    });
  });
});
