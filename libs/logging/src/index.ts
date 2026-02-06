import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { LogLevel } from "@aws-lambda-powertools/logger/types";

let loggerInstance: Logger | null = null;

export interface LoggerOptions {
  logLevel?: string;
  serviceName: string;
}

function isValidLogLevel(level: string = ""): level is LogLevel {
  return [
    "TRACE",
    "DEBUG",
    "INFO",
    "WARN",
    "ERROR",
    "SILENT",
    "CRITICAL",
  ].includes(level.toUpperCase());
}

/**
 * Returns a cached logger instance, or creates one if it doesn't exist.
 * If context is provided and different from the last used, injects context.
 */
export function getLogger(options?: LoggerOptions): Logger {
  if (!options) {
    if (!loggerInstance) {
      throw new Error(
        "Logger instance not initialized. Call getLogger with options first.",
      );
    }
    return loggerInstance;
  }

  const logLevel =
    options.logLevel?.toUpperCase() ??
    process.env.LOG_LEVEL?.toUpperCase() ??
    "INFO";

  return (loggerInstance = new Logger({
    logLevel: isValidLogLevel(logLevel) ? logLevel : "INFO",
    serviceName: options.serviceName,
  }));
}

/**
 * Creates a child logger from the cached logger instance.
 */
export function getChildLogger(childContext: Record<string, unknown>): Logger {
  if (!loggerInstance) {
    throw new Error("Logger instance not initialized. Call getLogger first.");
  }
  return loggerInstance.createChild(childContext);
}

export { injectLambdaContext };
export type { Logger };
