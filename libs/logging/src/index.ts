import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { LogLevel } from "@aws-lambda-powertools/logger/types";

import { LogSanitizer } from "./sanitizer";

function getLogLevel(level: string = "INFO"): LogLevel {
  return ([
    "TRACE",
    "DEBUG",
    "INFO",
    "WARN",
    "ERROR",
    "SILENT",
    "CRITICAL",
  ].find((l) => l === level.toUpperCase()) ?? "INFO") as LogLevel;
}

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

let loggerInstance: Logger | undefined;

export function createLogger(options: LoggerOptions): Logger {
  const sanitizer = options.sanitizer ?? defaultSanitizer;

  loggerInstance = new Logger({
    logLevel: getLogLevel(options.logLevel ?? process.env.LOG_LEVEL),
    serviceName: options.serviceName,
    jsonReplacerFn: sanitizer.createReplacer(),
  });

  return loggerInstance;
}

export function getLogger(): Logger {
  if (!loggerInstance) {
    throw new Error(
      "Logger not initialized. Call createLogger() in your createLambdaHandler config.",
    );
  }
  return loggerInstance;
}

export function getChildLogger(childContext: Record<string, unknown>): Logger {
  return getLogger().createChild(childContext);
}

export { injectLambdaContext };
export type { LogSanitizerOptions } from "./sanitizer";
export { LogSanitizer } from "./sanitizer";
export type { Logger };
