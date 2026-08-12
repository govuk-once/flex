import { LogFormatter, LogItem } from "@aws-lambda-powertools/logger";
import type {
  LogAttributes,
  UnformattedAttributes,
} from "@aws-lambda-powertools/logger/types";

/**
 * Custom log formatter for Flex platform.
 *
 * - Adds organizational context from environment variables
 * - Provides consistent log structure across all domains
 */
export class FlexLogFormatter extends LogFormatter {
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
      message: attributes.message,
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
    logItem.addAttributes(additionalLogAttributes);

    return logItem;
  }
}
