import { logger } from "@flex/logging";
import { APIGatewayProxyEventPathParameters } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { NonEmptyString } from "../schemas/common";
import { validatePathParams } from "./validatePathParams";

vi.mock("@flex/logging", () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

const testSchema = z.object({
  serviceName: NonEmptyString,
  identifier: NonEmptyString,
});

describe("validatePathParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully returns validated data when params are valid", () => {
    const data: APIGatewayProxyEventPathParameters = {
      serviceName: "test",
      identifier: "123",
    };

    const result = validatePathParams(testSchema, data);

    expect(logger.error).not.toHaveBeenCalled();
    expect(result).toEqual({ serviceName: "test", identifier: "123" });
  });

  it.each<{
    description: string;
    data: APIGatewayProxyEventPathParameters | null | undefined;
  }>([
    { description: "throws if pathParameters is null", data: null },
    {
      description: "throws if a field is missing",
      data: { serviceName: "test" },
    },
  ])("$description", ({ data }) => {
    expect(() => validatePathParams(testSchema, data)).toThrow();
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("[Path Parameters] Validation failed"),
    );
  });
});
