import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { LogLevel } from "@aws-lambda-powertools/logger/types";

import { LogSanitizer } from "./sanitizer";

const VALID_LOG_LEVELS: readonly string[] = [
  "TRACE",
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "SILENT",
  "CRITICAL",
];

const defaultSanitizer = new LogSanitizer({
  keyPatterns: [
    /secret/i,
    /token/i,
    /password/i,
    /passwd/i,
    /authorization/i,
    /apikey/i,
    /api_key/i,
    /credential/i,
    /private.?key/i,
    /access.?key/i,
    /client.?secret/i,
    /signing/i,
  ],
  valuePatterns: [
    /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, // JWT tokens
  ],
});

export interface LoggerOptions {
  logLevel?: string;
  serviceName: string;
  sanitizer?: LogSanitizer;
}

export class FlexLogger extends Logger {
  static #instance: FlexLogger | null = null;

  constructor(options: LoggerOptions) {
    const logLevel = options.logLevel?.toUpperCase() ?? process.env.LOG_LEVEL?.toUpperCase() ??  "INFO";
    const sanitizer = options.sanitizer ?? defaultSanitizer;
    const validLevel = VALID_LOG_LEVELS.includes(logLevel) ? (logLevel as LogLevel) : "INFO";

    super({
      logLevel: validLevel,
      serviceName: options.serviceName,
      jsonReplacerFn: sanitizer.createReplacer(),
    });

    FlexLogger.#instance = this;
  }

  static getInstance(): FlexLogger {
    if (!FlexLogger.#instance) {
      throw new Error(
        "Logger not initialized. Pass { serviceName, logLevel } to getLogger() in your createLambdaHandler config.",
      );
    }
    return FlexLogger.#instance;
  }
}

export function getLogger(options?: LoggerOptions): FlexLogger {
  return options ? new FlexLogger(options) : FlexLogger.getInstance();
}

export function getChildLogger(
  childContext: Record<string, unknown>,
): Logger {
  return FlexLogger.getInstance().createChild(childContext);
}

export { injectLambdaContext };
export { LogSanitizer } from "./sanitizer";
export type { LogSanitizerOptions } from "./sanitizer";
export type { Logger };
