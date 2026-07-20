import { Logger as PowerToolsLogger } from "@aws-lambda-powertools/logger";
import { search } from "@aws-lambda-powertools/logger/correlationId";
import { LogLevel } from "@aws-lambda-powertools/logger/types";

import { FlexLogFormatter } from "./formatter";

type FlexLoggerOptions = Omit<
  ConstructorParameters<typeof PowerToolsLogger>[0],
  "logFormatter" | "logRecordOrder"
>;

class FlexLogger extends PowerToolsLogger {
  readonly #formatter: FlexLogFormatter;

  constructor(options: FlexLoggerOptions = {}) {
    const formatter = new FlexLogFormatter();
    super({
      logLevel: "INFO",
      ...options,
      logFormatter: formatter,
      correlationIdSearchFn: search,
    });

    this.#formatter = formatter;
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
