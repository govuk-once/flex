import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import type { LogLevel } from "@aws-lambda-powertools/logger/types";

import { FlexLogFormatter } from "./formatter";
import { clampLogLevel } from "./logLevel";
import {
  addSecretValue,
  addSensitiveKey,
  addSensitivePattern,
} from "./sanitizer";

const effectiveLevel = clampLogLevel(
  process.env.POWERTOOLS_LOG_LEVEL ?? process.env.LOG_LEVEL ?? "INFO",
  process.env.FLEX_LOG_LEVEL_FLOOR ?? "INFO",
  process.env.FLEX_LOG_LEVEL_CEILING ?? "TRACE",
);

const formatter = new FlexLogFormatter();

export const logger = new Logger({
  logLevel: effectiveLevel as LogLevel,
  logFormatter: formatter,
});

/**
 * Sets the service name on the log formatter.
 * Called by createLambdaHandler — domain devs should not call this directly.
 */
export function setLogServiceName(name: string): void {
  formatter.setServiceName(name);
}

/**
 * Sets the log level on the logger instance (clamped between floor and ceiling).
 * Called by createLambdaHandler — domain devs should not call this directly.
 */
export function setLogLevel(level: string): void {
  const clamped = clampLogLevel(
    level,
    process.env.FLEX_LOG_LEVEL_FLOOR ?? "INFO",
    process.env.FLEX_LOG_LEVEL_CEILING ?? "TRACE",
  );
  logger.setLogLevel(clamped as LogLevel);
}

/**
 * Creates a child logger with additional persistent context.
 * Domain developers use this to decorate logs with request-specific data.
 */
export function createChildLogger(context?: Record<string, unknown>): Logger {
  return logger.createChild({ persistentKeys: context });
}

export {
  addSecretValue,
  addSensitiveKey,
  addSensitivePattern,
  injectLambdaContext,
};
export type { Logger };
