import { Logger } from '@aws-lambda-powertools/logger';
import { LogLevel } from '@aws-lambda-powertools/logger/types';

let loggerInstance: Logger | null = null;

export interface LoggerOptions {
  level: LogLevel;
  serviceName?: string;
}

/**
 * Returns a cached logger instance, or creates one if it doesn't exist.
 * If context is provided and different from the last used, injects context.
 * @param options - Logger configuration options
 * @param context - Optional Lambda context for injection
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

  return (loggerInstance = new Logger({ ...options, logLevel: options.level }));
}

/**
 * Creates a child logger from the cached logger instance.
 * @param childContext - Additional context for the child logger
 */
export function getChildLogger(childContext: Record<string, unknown>): Logger {
  if (!loggerInstance) {
    throw new Error('Logger instance not initialized. Call getLogger first.');
  }
  return loggerInstance.createChild(childContext);
}
