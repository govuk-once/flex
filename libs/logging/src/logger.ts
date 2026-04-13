import { Logger as PowerToolsLogger } from "@aws-lambda-powertools/logger";
import { LogLevel } from "@aws-lambda-powertools/logger/types";

import { FlexLogFormatter } from "./formatter";

class FlexLogger extends PowerToolsLogger {
  #formatter: FlexLogFormatter;

  constructor() {
    const formatter = new FlexLogFormatter();
    super({
      logLevel: "INFO",
      logFormatter: formatter,
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
