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
  #sanitize = createSanitizer();
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
      message: this.#sanitize("message", attributes.message) as string,
      timestamp: this.formatTimestamp(attributes.timestamp),
      service: this.#serviceName ?? attributes.serviceName,
    };

    // Add organizational context from environment variables
    if (process.env.FLEX_ORG) {
      baseAttributes.org = process.env.FLEX_ORG;
    }
    if (process.env.FLEX_TEAM) {
      baseAttributes.team = process.env.FLEX_TEAM;
    }

    // Add Lambda context if available
    if (attributes.lambdaContext) {
      baseAttributes.function_name = attributes.lambdaContext.functionName;
      baseAttributes.request_id = attributes.lambdaContext.awsRequestId;
    }

    // Add X-Ray trace ID if available
    if (attributes.xRayTraceId) {
      baseAttributes.xray_trace_id = attributes.xRayTraceId;
    }

    // Add sampling rate if set
    if (attributes.sampleRateValue) {
      baseAttributes.sampling_rate = attributes.sampleRateValue;
    }

    const logItem = new LogItem({ attributes: baseAttributes });

    // Add and sanitize additional attributes
    const sanitizedAdditional = this.#sanitizeAttributes(
      additionalLogAttributes,
    );
    logItem.addAttributes(sanitizedAdditional);

    return logItem;
  }

  #sanitizeAttributes(attributes: LogAttributes): LogAttributes {
    const sanitized: LogAttributes = {};

    for (const [key, value] of Object.entries(attributes)) {
      if (Array.isArray(value)) {
        sanitized[key] = this.#sanitizeArray(key, value);
      } else if (value !== null && typeof value === "object") {
        sanitized[key] = this.#sanitizeAttributes(value as LogAttributes);
      } else {
        const sanitizedValue = this.#sanitize(key, value);
        if (sanitizedValue !== undefined) {
          sanitized[key] = sanitizedValue as LogAttributes[keyof LogAttributes];
        }
      }
    }

    return sanitized;
  }

  #sanitizeArray(key: string, items: unknown[]): unknown[] {
    return items.map((item) => {
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        return this.#sanitizeAttributes(item as LogAttributes);
      }
      if (Array.isArray(item)) {
        return this.#sanitizeArray(key, item);
      }
      return this.#sanitize(key, item);
    });
  }
}
