import type { Logger } from "./logger";
import { logger } from "./logger";

/**
 * Creates a child logger with additional persistent context.
 * Domain developers use this to decorate logs with request-specific data.
 */
export function createChildLogger(context?: Record<string, unknown>): Logger {
  return logger.createChild({ persistentKeys: context });
}

export type { Logger } from "./logger";
export { logger } from "./logger";
export {
  addSecretValue,
  addSensitiveKey,
  addSensitivePattern,
} from "./sanitizer";
export { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
export type { LogLevel } from "@aws-lambda-powertools/logger/types";
