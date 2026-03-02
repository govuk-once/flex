const REDACTED = "***REDACTED***";

const defaultKeyPatterns: Array<RegExp> = [
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
];

const defaultValuePatterns: Array<RegExp> = [
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, // JWT tokens
];

const secretValues: string[] = [];
let secretValuesRegex: RegExp | null = null;

function rebuildSecretRegex(): void {
  if (!secretValues.length) {
    secretValuesRegex = null;
    return;
  }

  const pattern = secretValues
    .sort((a, b) => b.length - a.length) // Longest first to avoid partial matches
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) // Escape regex chars
    .join("|");

  secretValuesRegex = new RegExp(pattern, "gi");
}

function matchesKeyPattern(key: string): boolean {
  return defaultKeyPatterns.some((pattern) => pattern.test(key));
}

function matchesValuePattern(value: string): boolean {
  return defaultValuePatterns.some((pattern) => pattern.test(value));
}

/**
 * Resets all registered secret values.
 * Intended for test isolation — production code should not call this.
 */
export function resetSanitizer(): void {
  secretValues.length = 0;
  secretValuesRegex = null;
}

/**
 * Adds a secret value to be redacted from logs.
 * Call this after loading secrets to ensure they are sanitized.
 */
export function addSecretValue(value: unknown): void {
  if (value === null || value === undefined) {
    return;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return;
  }

  const stringValue = String(value).trim();
  if (stringValue && !secretValues.includes(stringValue)) {
    secretValues.push(stringValue);
    rebuildSecretRegex();
  }
}

/**
 * Creates a JSON replacer function for sanitizing log output.
 */
export function createSanitizer(): (key: string, value: unknown) => unknown {
  return (key: string, value: unknown): unknown => {
    // Redact entire value if key matches sensitive patterns
    if (key && matchesKeyPattern(key)) {
      return REDACTED;
    }

    if (typeof value !== "string") {
      return value;
    }

    // Redact entire value if it matches sensitive value patterns (e.g., JWT)
    if (matchesValuePattern(value)) {
      return REDACTED;
    }

    // Replace secret values within the string, keeping the rest
    if (secretValuesRegex) {
      return value.replace(secretValuesRegex, REDACTED);
    }

    return value;
  };
}
