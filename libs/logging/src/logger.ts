import { Logger as PowerToolsLogger } from "@aws-lambda-powertools/logger";
import { search } from "@aws-lambda-powertools/logger/correlationId";
import type { ConstructorOptions } from "@aws-lambda-powertools/logger/types";
import { LogLevel } from "@aws-lambda-powertools/logger/types";

import { FlexLogFormatter } from "./formatter";
import { createSanitizer } from "./sanitizer";

// ConstructorOptions is a union, so Omit must distribute over each member
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type FlexLoggerOptions = DistributiveOmit<
  ConstructorOptions,
  "logFormatter" | "logRecordOrder" | "jsonReplacerFn"
>;

class FlexLogger extends PowerToolsLogger {
  readonly #formatter: FlexLogFormatter;

  constructor(
    options: FlexLoggerOptions = {},
    formatter: FlexLogFormatter = new FlexLogFormatter(),
  ) {
    super({
      logLevel: "INFO",
      ...options,
      logFormatter: formatter,
      jsonReplacerFn: createSanitizer(),
      correlationIdSearchFn: search,
    });

    this.#formatter = formatter;
  }

  /**
   * PowerTools' createChild() builds children via createLogger(), which
   * defaults to `new Logger()`. Override it so children are FlexLoggers too
   * (keeping the production log-level guard), sharing the parent's formatter
   * as PowerTools does. The Flex-owned options are re-applied by the
   * constructor, so the parent's copies are dropped here.
   */
  protected createLogger(options: ConstructorOptions = {}): FlexLogger {
    const {
      logFormatter: _logFormatter,
      logRecordOrder: _logRecordOrder,
      jsonReplacerFn: _jsonReplacerFn,
      ...rest
    } = options;
    return new FlexLogger(rest, this.#formatter);
  }

  createChild(options: ConstructorOptions = {}): FlexLogger {
    const child = super.createChild(options);
    if (!(child instanceof FlexLogger)) {
      throw new TypeError("Expected createChild to return a FlexLogger");
    }
    return child;
  }

  setLogLevel(level: LogLevel): void {
    if (process.env.FLEX_ENVIRONMENT === "production") {
      return;
    }
    super.setLogLevel(level);
  }
  setServiceName(name: string): void {
    this.#formatter.setServiceName(name);
  }
}

export const logger = new FlexLogger();
export type Logger = typeof logger;
