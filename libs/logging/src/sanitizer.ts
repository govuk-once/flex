const REDACTED = "***secret-value***";

export interface LogSanitizerOptions {
  keyPatterns?: Array<string | RegExp>;
  valuePatterns?: Array<string | RegExp>;
  parseStringifiedJson?: boolean;
}

export class LogSanitizer {
  #keyPatterns: Array<string | RegExp>;
  #valuePatterns: Array<string | RegExp>;
  #parseStringifiedJson: boolean;

  constructor(options: LogSanitizerOptions = {}) {
    this.#keyPatterns = options.keyPatterns ?? [];
    this.#valuePatterns = options.valuePatterns ?? [];
    this.#parseStringifiedJson = options.parseStringifiedJson ?? false;
  }

  #matches(value: string, patterns: Array<string | RegExp>): boolean {
    return patterns.some((pattern) => {
      if (typeof pattern === "string") {
        return value.toLowerCase().includes(pattern.toLowerCase());
      }
      return pattern.test(value);
    });
  }

  createReplacer(): (key: string, value: unknown) => unknown {
    return (key: string, value: unknown): unknown => {
      if (key && this.#matches(key, this.#keyPatterns)) {
        return REDACTED;
      }

      if (typeof value === "string") {
        if (this.#matches(value, this.#valuePatterns)) {
          return REDACTED;
        }

        if (this.#parseStringifiedJson) {
          try {
            const parsed: unknown = JSON.parse(value);
            if (parsed !== null && typeof parsed === "object") {
              return JSON.stringify(parsed, this.createReplacer());
            }
          } catch {
            // not valid JSON, return as-is
          }
        }
      }

      return value;
    };
  }
}
