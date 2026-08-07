import createHttpError from "http-errors";
import { status } from "http-status";
import { describe, expect, it } from "vitest";

import { handleDvlaErrorResponse } from "./errors";

describe("handleDvlaErrorResponse", () => {
  it("WHEN a common DVLA error (GUK-404-01) is thrown THEN it returns the formatted error response", () => {
    const error = createHttpError(status.NOT_FOUND, "Not Found", {
      code: "GUK-404-01",
    });

    const result = handleDvlaErrorResponse(error);

    expect(result).toEqual({
      status: status.NOT_FOUND,
      error: {
        code: "GUK-404-01",
        message: "Linking ID held is no longer valid",
      },
    });
  });

  it("WHEN an endpoint-specific code (GUK-404-04) is passed in custom mappings THEN it returns the custom error payload", () => {
    const error = createHttpError(status.NOT_FOUND, "Driving Licence not found", {
      code: "GUK-404-04",
    });

    const customMappings = {
      "GUK-404-04": "Driving Licence not found",
    };

    const result = handleDvlaErrorResponse(error, customMappings);

    expect(result).toEqual({
      status: status.NOT_FOUND,
      error: {
        code: "GUK-404-04",
        message: "Driving Licence not found",
      },
    });
  });

  it("WHEN custom mappings override a common error code THEN the custom mapping takes precedence", () => {
    const error = createHttpError(status.NOT_FOUND, "Not Found", {
      code: "GUK-404-01",
    });

    const customMappings = {
      "GUK-404-01": "Custom overridden message",
    };

    const result = handleDvlaErrorResponse(error, customMappings);

    expect(result.error.message).toBe("Custom overridden message");
  });

  it.for([
    {
      description: "WHEN a 404 HttpError has an unmapped code THEN it re-throws",
      error: createHttpError(status.NOT_FOUND, "Resource not found", {
        code: "GUK-404-99",
      }),
    },
    {
      description: "WHEN a 404 HttpError has no code property THEN it re-throws",
      error: createHttpError(status.NOT_FOUND, "Not found"),
    },
    {
      description: "WHEN a non-404 HttpError (500) is thrown THEN it re-throws",
      error: createHttpError(status.INTERNAL_SERVER_ERROR, "Server Error"),
    },
    {
      description: "WHEN a standard non-HttpError is thrown THEN it re-throws",
      error: new Error("Standard JS Error"),
    },
  ])("$description", ({ error }) => {
    expect(() => handleDvlaErrorResponse(error)).toThrow(error);
  });
});
