import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import type { LogLevel } from "@aws-lambda-powertools/logger/types";

import { Logger, logger } from "./logger";
import {
  addSecretValue,
  addSensitiveKey,
  addSensitivePattern,
} from "./sanitizer";

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
  logger,
};
export type { Logger, LogLevel };
