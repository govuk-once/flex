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
  ): UnformattedAttributes => ({
    logLevel: "INFO",
    message: "Test message",
    timestamp: new Date("2024-01-15T10:30:00.000Z"),
    serviceName: "test-service",
    sampleRateValue: 0,
    awsRegion: "",
    environment: "",
    ...overrides,
  });

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
        .formatAttributes(createBaseAttributes({ xRayTraceId }), {})
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
          }),
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

  describe("nested and array sanitization", () => {
    const REDACTED = "***REDACTED***";
    const redactSensitiveKeys = (key: string, value: unknown) =>
      /secret|token|credential|authorization/i.test(key) ? REDACTED : value;

    beforeEach(() => {
      sanitizeFn.mockImplementation(redactSensitiveKeys);
    });

    it("redacts an object nested under a sensitive key", () => {
      const output = new FlexLogFormatter()
        .formatAttributes(createBaseAttributes(), {
          credentials: { value: "leak", inner: { deep: "leak" } },
        })
        .getAttributes();

      expect(output.credentials).toBe(REDACTED);
    });

    it("redacts objects inside an array under a sensitive key", () => {
      const output = new FlexLogFormatter()
        .formatAttributes(createBaseAttributes(), {
          tokens: [{ value: "leak" }, { value: "leak" }],
        })
        .getAttributes();

      expect(output.tokens).toBe(REDACTED);
    });

    it("redacts an array of primitives under a sensitive key to a single value", () => {
      const output = new FlexLogFormatter()
        .formatAttributes(createBaseAttributes(), {
          secretTokens: ["a", "b"],
        })
        .getAttributes();

      expect(output.secretTokens).toBe(REDACTED);
    });

    it("redacts a sensitive key nested deep under non-sensitive keys", () => {
      const output = new FlexLogFormatter()
        .formatAttributes(createBaseAttributes(), {
          request: { headers: { authorization: "Bearer x" }, path: "/health" },
        })
        .getAttributes();

      expect(output.request).toEqual({
        headers: { authorization: REDACTED },
        path: "/health",
      });
    });

    it("recurses into objects and arrays under non-sensitive keys", () => {
      const output = new FlexLogFormatter()
        .formatAttributes(createBaseAttributes(), {
          context: { secret: "leak", safe: "ok" },
          items: [{ token: "leak", id: 1 }],
        })
        .getAttributes();

      expect(output.context).toEqual({ secret: REDACTED, safe: "ok" });
      expect(output.items).toEqual([{ token: REDACTED, id: 1 }]);
    });
  });
});
