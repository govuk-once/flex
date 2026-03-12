import { beforeEach } from "node:test";

import { logger } from "@flex/logging";
import { APIGatewayProxyEventPathParameters } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { validatePathParams } from "./validatePathParams";

vi.mock("@flex/logging");

const testSchema = z.object({
  serviceName: z.string().min(1),
  identifier: z.string().min(1),
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

    expect(result).toEqual({ serviceName: "test", identifier: "123" });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.error).not.toHaveBeenCalled();
  });

  interface TestCase {
    description: string;
    data: APIGatewayProxyEventPathParameters | null | undefined;
  }

  it.each<TestCase>([
    {
      description: "throws if pathParameters is null",
      data: null,
    },
    {
      description: "throws if a field is missing",
      data: { serviceName: "test" },
    },
  ])("$description", ({ data }) => {
    expect(() => validatePathParams(testSchema, data)).toThrow();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("[Path Parameters] Validation failed"),
    );
  });
});
