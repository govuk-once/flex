import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import type { LogLevel } from "@aws-lambda-powertools/logger/types";

import { FlexLogFormatter } from "./formatter";
import { Logger } from "./logger";
import {
  addSecretValue,
  addSensitiveKey,
  addSensitivePattern,
} from "./sanitizer";

const formatter = new FlexLogFormatter();

let cachedLogger: Logger | null = null;

/**
 * Returns the cached logger instance or initializes a new one if not already created.
 * Does not allow re-initialization with a different service name or log level after the logger has been created.
 * If the logger is not initialized and required parameters are missing, it will initialize with default values and log a warning without caching the logger.
 *
 * @param serviceName - The name of the service to be used in logs. Required on first initialization.
 * @param logLevel - The log level to be used. Required on first initialization.
 * @returns The logger instance.
 * @throws Error if the logger is not initialized and required parameters are missing.
 */
export function logger(serviceName?: string, logLevel?: LogLevel): Logger {
  const serviceNameOrDefault = serviceName ?? "unknown-service";
  const logLevelOrDefault = logLevel ?? "INFO";

  if (!cachedLogger && (!serviceName || !logLevel)) {
    const newLogger = new Logger({
      serviceName: serviceNameOrDefault,
      logLevel: logLevelOrDefault,
      logFormatter: formatter,
    });
    newLogger.warn(
      "Logger is not fully initialized. Service name and log level should be provided on first initialization for optimal logging. Using defaults for now.",
      { attemptedServiceName: serviceName, attemptedLogLevel: logLevel },
    );

    return newLogger;
  }

  if (cachedLogger && (serviceName || logLevel)) {
    cachedLogger.warn(
      "Logger has already been initialized. Subsequent calls to logger() with parameters are ignored. The initial service name and log level will be used.",
      { attemptedServiceName: serviceName, attemptedLogLevel: logLevel },
    );
  }

  return (cachedLogger ??= new Logger({
    serviceName: serviceNameOrDefault,
    logLevel: logLevelOrDefault,
    logFormatter: formatter,
  }));
}

/**
 * Creates a child logger with additional persistent context.
 * Domain developers use this to decorate logs with request-specific data.
 */
export function createChildLogger(context?: Record<string, unknown>): Logger {
  return logger().createChild({ persistentKeys: context });
}

export {
  addSecretValue,
  addSensitiveKey,
  addSensitivePattern,
  injectLambdaContext,
};
export type { Logger, LogLevel };
