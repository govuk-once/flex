import { Logger as PowerToolsLogger } from "@aws-lambda-powertools/logger";
import { LogLevel } from "@aws-lambda-powertools/logger/types";

export class Logger extends PowerToolsLogger {
  /**
   * Stubbed out to prevent domain developers from changing log level on child loggers. Log level should only be set once by the SDK, and then inherited by child loggers.
   * @param _
   */
  setLogLevel(_: LogLevel): void {}
}
