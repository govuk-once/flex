import { Logger } from '@aws-lambda-powertools/logger';
import { LogLevel } from '@aws-lambda-powertools/logger/types';

let loggerInstance: Logger | null = null;

export interface LoggerOptions {
  logLevel?: LogLevel;
  serviceName: string;
}

/**
 * Returns a cached logger instance, or creates one if it doesn't exist.
 * If context is provided and different from the last used, injects context.
 */

export function getLogger(): Logger;
export function getLogger(options: LoggerOptions): Logger;
export function getLogger(options?: LoggerOptions): Logger {
  if (!options) {
    if (!loggerInstance) {
      throw new Error(
        'Logger instance not initialized. Call getLogger with options first.',
      );
    }
    return loggerInstance;
  }

  return (loggerInstance = new Logger({
    logLevel: options.logLevel ?? 'INFO',
    serviceName: options.serviceName,
  }));
}

/**
 * Creates a child logger from the cached logger instance.
 */
export function getChildLogger(childContext: Record<string, unknown>): Logger {
  if (!loggerInstance) {
    throw new Error('Logger instance not initialized. Call getLogger first.');
  }
  return loggerInstance.createChild(childContext);
}
