import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";

import { FlexLogFormatter } from "./formatter";
import {
  addSecretValue,
  addSensitiveKey,
  addSensitivePattern,
} from "./sanitizer";

const formatter = new FlexLogFormatter();

export const logger = new Logger({
  logLevel: "INFO",
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
