import type { UnformattedAttributes } from "@aws-lambda-powertools/logger/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sanitizeFn = vi.fn((_key: string, value: unknown) => value);
vi.mock("./sanitizer", () => ({
  createSanitizer: () => sanitizeFn,
}));

import { FlexLogFormatter } from "./formatter";

describe("FlexLogFormatter", () => {
  const createBaseAttributes = (
    overrides: Partial<UnformattedAttributes> = {},
  ): UnformattedAttributes =>
    ({
      logLevel: "INFO",
      message: "Test message",
      timestamp: new Date("2024-01-15T10:30:00.000Z"),
      serviceName: "test-service",
      sampleRateValue: 0,
      awsRegion: "",
      environment: "",
      ...overrides,
    }) as UnformattedAttributes;

  beforeEach(() => {
    vi.unstubAllEnvs();
    sanitizeFn.mockClear();
    sanitizeFn.mockImplementation((_key: string, value: unknown) => value);
  });

  describe("formatAttributes", () => {
    it("maps base attributes to output structure", () => {
      const formatter = new FlexLogFormatter();
      const output = formatter
        .formatAttributes(createBaseAttributes(), {})
        .getAttributes();

      expect(output).toMatchObject({
        level: "INFO",
        message: "Test message",
        service: "test-service",
      });
      expect(output.timestamp).toBeDefined();
      expect(output.org).toBeUndefined();
      expect(output.team).toBeUndefined();
    });

    it("adds org from FLEX_ORG env var", () => {
      vi.stubEnv("FLEX_ORG", "my-org");
      const formatter = new FlexLogFormatter();
      const output = formatter
        .formatAttributes(createBaseAttributes(), {})
        .getAttributes();
      expect(output.org).toBe("my-org");
    });

    it("adds team from FLEX_TEAM env var", () => {
      vi.stubEnv("FLEX_TEAM", "my-team");
      const formatter = new FlexLogFormatter();
      const output = formatter
        .formatAttributes(createBaseAttributes(), {})
        .getAttributes();
      expect(output.team).toBe("my-team");
    });

    it("maps Lambda context fields", () => {
      const formatter = new FlexLogFormatter();
      const output = formatter
        .formatAttributes(
          createBaseAttributes({
            lambdaContext: {
              functionName: "my-function",
              awsRequestId: "request-123",
              invokedFunctionArn:
                "arn:aws:lambda:us-east-1:123456789012:function:my-function",
              memoryLimitInMB: "128",
              functionVersion: "$LATEST",
              coldStart: true,
              tenantId: undefined,
            },
          }),
          {},
        )
        .getAttributes();

      expect(output.function_name).toBe("my-function");
      expect(output.request_id).toBe("request-123");
    });

    it("maps X-Ray trace ID", () => {
      const xRayTraceId = "1-5f4e7a3c-abc123";
      const formatter = new FlexLogFormatter();
      const output = formatter
        .formatAttributes(
          createBaseAttributes({ xRayTraceId }),
          {},
        )
        .getAttributes();
      expect(output.xray_trace_id).toBe(xRayTraceId);
    });

    it("maps sampling rate", () => {
      const formatter = new FlexLogFormatter();
      const output = formatter
        .formatAttributes(createBaseAttributes({ sampleRateValue: 0.5 }), {})
        .getAttributes();
      expect(output.sampling_rate).toBe(0.5);
    });

    it("uses setServiceName override over attributes.serviceName", () => {
      const formatter = new FlexLogFormatter();
      formatter.setServiceName("overridden");
      const output = formatter
        .formatAttributes(
          createBaseAttributes({
            serviceName: "original",
          } as Partial<UnformattedAttributes>),
          {},
        )
        .getAttributes();
      expect(output.service).toBe("overridden");
    });

    it("sanitizes the log message", () => {
      const formatter = new FlexLogFormatter();
      formatter.formatAttributes(createBaseAttributes(), {});
      expect(sanitizeFn).toHaveBeenCalledWith("message", "Test message");
    });

    it("applies sanitizer redaction to the log message", () => {
      sanitizeFn.mockImplementation((key: string, value: unknown) =>
        key === "message" ? "***REDACTED***" : value,
      );
      const formatter = new FlexLogFormatter();
      const output = formatter
        .formatAttributes(createBaseAttributes(), {})
        .getAttributes();
      expect(output.message).toBe("***REDACTED***");
    });

    it("delegates leaf values to the sanitizer", () => {
      const formatter = new FlexLogFormatter();
      formatter.formatAttributes(createBaseAttributes(), {
        flat: "value",
        nested: { inner: "deep" },
        list: [{ key: "val" }],
        tags: ["a", "b"],
      });

      expect(sanitizeFn).toHaveBeenCalledWith("flat", "value");
      expect(sanitizeFn).toHaveBeenCalledWith("inner", "deep");
      expect(sanitizeFn).toHaveBeenCalledWith("key", "val");
      expect(sanitizeFn).toHaveBeenCalledWith("tags", "a");
      expect(sanitizeFn).toHaveBeenCalledWith("tags", "b");
    });

    it("excludes attributes when sanitizer returns undefined", () => {
      sanitizeFn.mockReturnValue(undefined);
      const formatter = new FlexLogFormatter();
      const output = formatter
        .formatAttributes(createBaseAttributes(), {
          shouldBeExcluded: "value",
        })
        .getAttributes();

      expect(output.shouldBeExcluded).toBeUndefined();
    });
  });
});
