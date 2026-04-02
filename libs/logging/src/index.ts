import { Logger as FullLogger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import type { LogLevel } from "@aws-lambda-powertools/logger/types";

import { FlexLogFormatter } from "./formatter";
import {
  addSecretValue,
  addSensitiveKey,
  addSensitivePattern,
} from "./sanitizer";

type Logger = Omit<FullLogger, "setLogLevel">;

const formatter = new FlexLogFormatter();

const _logger = new FullLogger({
  logLevel: "INFO",
  logFormatter: formatter,
});

/**
 * Logger instance for domain developers. Log level management is restricted
 * to the SDK - use setLogLevel (called by createLambdaHandler) instead.
 */
export const logger: Omit<Logger, "setLogLevel"> = _logger;

/**
 * Sets the service name on the log formatter.
 * Called by createLambdaHandler — domain devs should not call this directly.
 */
export function setLogServiceName(name: string): void {
  formatter.setServiceName(name);
}

/**
 * Sets the log level from the domain config.
 * Called by createLambdaHandler
 */
let logLevelSet = false;
export function setLogLevel(level: string): void {
  if (logLevelSet) {
    _logger.warn(
      "Attempted to set log level after it was already set. This call will be ignored.",
      { attemptedLevel: level },
    );
    return;
  }

  logLevelSet = true;
  _logger.setLogLevel(level as LogLevel);
}

/**
 * Creates a child logger with additional persistent context.
 * Domain developers use this to decorate logs with request-specific data.
 */
export function createChildLogger(
  context?: Record<string, unknown>,
): Omit<Logger, "setLogLevel"> {
  return _logger.createChild({ persistentKeys: context });
}

export {
  addSecretValue,
  addSensitiveKey,
  addSensitivePattern,
  injectLambdaContext,
};
export type { FullLogger, Logger };
