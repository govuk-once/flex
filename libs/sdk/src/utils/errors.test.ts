import { it } from "@flex/testing";
import { describe, expect } from "vitest";
import type { ZodError } from "zod";

import {
  AuthorizationError,
  HeaderValidationError,
  QueryParametersParseError,
  RequestBodyParseError,
} from "./errors";

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

  describe("QueryParametersParseError", () => {
    it("has statusCode 400 with formatted field errors", () => {
      const error = new QueryParametersParseError({
        issues: [{ path: ["fieldName"], message: "Required" }],
      } as ZodError);

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("QueryParametersParseError");
      expect(error.message).toBe("Invalid query parameters");
      expect(error.errors).toStrictEqual([
        { field: "fieldName", message: "Required" },
      ]);
    });

    it("joins nested issues with dot notation", () => {
      const error = new QueryParametersParseError({
        issues: [{ path: ["field", "name"], message: "Required" }],
      } as ZodError);

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("QueryParametersParseError");
      expect(error.message).toBe("Invalid query parameters");
      expect(error.errors).toStrictEqual([
        { field: "field.name", message: "Required" },
      ]);
    });
  });

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
