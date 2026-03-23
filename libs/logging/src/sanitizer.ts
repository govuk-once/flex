const REDACTED = "***REDACTED***";

const secretKeyPatterns: Array<RegExp> = [
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

const piiKeyPatterns: Array<RegExp> = [
  /\bemail\b/i,
  /\bphone\b/i,
  /\bmobile\b/i,
  /\bforename\b/i,
  /\bsurname\b/i,
  /\bfirst.?name\b/i,
  /\blast.?name\b/i,
  /\bfull.?name\b/i,
  /\bdate.?of.?birth\b/i,
  /\bdob\b/i,
  /\bnino\b/i,
  /\bnational.?insurance\b/i,
  /\bpostcode\b/i,
  /\bzip.?code\b/i,
  /\bsort.?code\b/i,
  /\baccount.?number\b/i,
  /\bip.?address\b/i,
];

const secretValuePatterns: Array<RegExp> = [
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, // JWT tokens
];

const piiValuePatterns: Array<RegExp> = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email addresses
  /(?:\+44|0)\d{9,10}/, // UK phone numbers
  /\b[A-Z]{2}\d{6}[A-D]\b/, // National Insurance numbers
  /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i, // UK postcodes
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IPv4 addresses
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

function isPiiDebugEnabled(): boolean {
  if (process.env.FLEX_ENVIRONMENT === "production") return false;
  return process.env.FLEX_LOG_PII_DEBUG === "true";
}

function matchesKeyPattern(key: string): boolean {
  if (secretKeyPatterns.some((pattern) => pattern.test(key))) return true;
  if (isPiiDebugEnabled()) return false;
  return piiKeyPatterns.some((pattern) => pattern.test(key));
}

function matchesValuePattern(value: string): boolean {
  if (secretValuePatterns.some((pattern) => pattern.test(value))) return true;
  if (isPiiDebugEnabled()) return false;
  return piiValuePatterns.some((pattern) => pattern.test(value));
}

/**
 * Marks a key name as sensitive so its value is redacted from logs.
 * Accepts a RegExp or a string (converted to a case-insensitive regex).
 * Follows PII rules: bypassed by FLEX_LOG_PII_DEBUG in non-production.
 */
export function addSensitiveKey(pattern: RegExp | string): void {
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
  piiKeyPatterns.push(regex);
}

/**
 * Adds a pattern to detect sensitive data in log values.
 * Accepts a RegExp or a string (converted to a case-insensitive regex).
 * Follows PII rules: bypassed by FLEX_LOG_PII_DEBUG in non-production.
 */
export function addSensitivePattern(pattern: RegExp | string): void {
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
  piiValuePatterns.push(regex);
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
    if (key && matchesKeyPattern(key)) {
      return REDACTED;
    }

    if (typeof value !== "string") {
      return value;
    }

    if (matchesValuePattern(value)) {
      return REDACTED;
    }

    if (secretValuesRegex) {
      return value.replace(secretValuesRegex, REDACTED);
    }

    return value;
  };
}
