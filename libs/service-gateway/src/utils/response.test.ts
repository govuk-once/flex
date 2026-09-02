import { logger } from "@flex/logging";
import { it } from "@flex/testing";
import {
  HeaderValidationError,
  QueryParametersParseError,
  RequestBodyParseError,
} from "@flex/utils";
import createHttpError from "http-errors";
import { describe, expect, vi } from "vitest";

import { toDownstreamErrorResponse, toGatewayErrorResponse } from "./response";

vi.mock("@flex/logging", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@flex/telemetry");

describe("toGatewayErrorResponse", () => {
  it("maps a header validation error to 400 with the missing headers", ({
    platform,
  }) => {
    expect(
      toGatewayErrorResponse(new HeaderValidationError(["key"])),
    ).toStrictEqual(
      platform.gatewayResult(400, {
        body: {
          message: "Missing headers: key",
          type: "validation_error",
          errors: [{ field: "key", message: "Required header missing" }],
        },
      }),
    );
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      "Missing required headers",
      { headers: ["key"] },
    );
  });

  it("maps a query parameters parsing error to 400 with the issues", ({
    platform,
  }) => {
    expect(
      toGatewayErrorResponse(
        new QueryParametersParseError({ issues: [] } as never),
      ),
    ).toStrictEqual(
      platform.gatewayResult(400, {
        body: { message: "Invalid query parameters", type: "validation_error" },
      }),
    );
  });

  it("maps a request body parse error to 400 with its message", ({
    platform,
  }) => {
    expect(
      toGatewayErrorResponse(new RequestBodyParseError("test error")),
    ).toStrictEqual(
      platform.gatewayResult(400, {
        body: { message: "test error", type: "validation_error" },
      }),
    );
  });

  it.for([
    {
      error: new createHttpError.NotFound("test error"),
      level: "warn" as const,
      statusCode: 404,
      expectedMessage: "test error",
      type: "client_error" as const,
    },
    {
      error: new createHttpError.BadGateway("test error"),
      level: "error" as const,
      statusCode: 502,
      expectedMessage: "Internal server error",
      type: "server_error" as const,
    },
  ])(
    "returns http-error with log level set to $level",
    ({ error, level, statusCode, expectedMessage, type }, { platform }) => {
      expect(toGatewayErrorResponse(error)).toStrictEqual(
        platform.gatewayResult(statusCode, {
          body: { message: expectedMessage, type },
        }),
      );
      expect(logger[level]).toHaveBeenCalledWith(error.message, {
        statusCode,
      });
    },
  );

  it("maps an unknown error to 500", ({ platform }) => {
    expect(toGatewayErrorResponse(new Error("test error"))).toStrictEqual(
      platform.gatewayResult(500, {
        body: { message: "Internal server error", type: "server_error" },
      }),
    );
  });
});

describe("toDownstreamErrorResponse", () => {
  const domain = "example-domain";

  it("maps 5xx errors to 502 and omits the downstream body", ({ platform }) => {
    expect(
      toDownstreamErrorResponse(domain, {
        status: 503,
        message: "test error",
        body: { leak: true },
      }),
    ).toStrictEqual(
      platform.gatewayResult(502, {
        body: {
          message: "example-domain upstream service unavailable",
          type: "server_error",
        },
      }),
    );
  });

  it("maps a 4xx error to client_error and preserves downstream extras", ({
    platform,
  }) => {
    expect(
      toDownstreamErrorResponse(domain, {
        status: 404,
        message: "test error message",
        body: { detail: "test error detail" },
      }),
    ).toStrictEqual(
      platform.gatewayResult(404, {
        body: {
          detail: "test error detail",
          message: "test error message",
          type: "client_error",
          error: { detail: "test error detail" },
        },
      }),
    );
  });

  it("maps a 4xx error to client_error when no downstream body is provided", ({
    platform,
  }) => {
    expect(
      toDownstreamErrorResponse(domain, {
        status: 400,
        message: "test error message",
      }),
    ).toStrictEqual(
      platform.gatewayResult(400, {
        body: { message: "test error message", type: "client_error" },
      }),
    );
  });
});
