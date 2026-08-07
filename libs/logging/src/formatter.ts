import { LogFormatter, LogItem } from "@aws-lambda-powertools/logger";
import type {
  LogAttributes,
  UnformattedAttributes,
} from "@aws-lambda-powertools/logger/types";

import { createSanitizer } from "./sanitizer";

/**
 * Custom log formatter for Flex platform.
 *
 * - Adds organizational context from environment variables
 * - Sanitizes sensitive data
 * - Provides consistent log structure across all domains
 */
export class FlexLogFormatter extends LogFormatter {
  readonly #sanitize = createSanitizer();
  #serviceName?: string;

  setServiceName(name: string): void {
    this.#serviceName = name;
  }

  public formatAttributes(
    attributes: UnformattedAttributes,
    additionalLogAttributes: LogAttributes,
  ): LogItem {
    const baseAttributes: LogAttributes = {
      level: attributes.logLevel,
      message: this.#sanitize("message", attributes.message),
      timestamp: this.formatTimestamp(attributes.timestamp),
      service: this.#serviceName ?? attributes.serviceName,
    };

    if (process.env.FLEX_ORG) {
      baseAttributes.org = process.env.FLEX_ORG;
    }
    if (process.env.FLEX_TEAM) {
      baseAttributes.team = process.env.FLEX_TEAM;
    }

    if (attributes.lambdaContext) {
      baseAttributes.function_name = attributes.lambdaContext.functionName;
      baseAttributes.request_id = attributes.lambdaContext.awsRequestId;
    }

    if (attributes.xRayTraceId) {
      baseAttributes.xray_trace_id = attributes.xRayTraceId;
    }

    if (attributes.sampleRateValue) {
      baseAttributes.sampling_rate = attributes.sampleRateValue;
    }

    const logItem = new LogItem({ attributes: baseAttributes });

    const sanitizedAdditional = this.#sanitizeAttributes(
      additionalLogAttributes,
    );
    logItem.addAttributes(sanitizedAdditional);

    return logItem;
  }

  #sanitizeAttributes(attributes: LogAttributes): LogAttributes {
    const entries = Object.entries(attributes)
      .map(([key, value]) => [key, this.#sanitizeValue(key, value)] as const)
      .filter(([, value]) => value !== undefined);

    return Object.fromEntries(entries);
  }

  #sanitizeValue(key: string, value: unknown): unknown {
    const sanitized = this.#sanitize(key, value);

    // A sensitive key (or a value/secret match) redacts the whole branch, so a
    // nested object or array under it never gets walked in the clear.
    if (sanitized !== value) {
      return sanitized;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.#sanitizeValue(key, item));
    }

    if (value !== null && typeof value === "object") {
      return this.#sanitizeAttributes(value as LogAttributes);
    }

    return sanitized;
  }
}
