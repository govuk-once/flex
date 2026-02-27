import { beforeEach, describe, expect, it } from "vitest";

import { addSecretValue, createSanitizer, resetSanitizer } from "./sanitizer";

describe("sanitizer", () => {
  beforeEach(() => {
    resetSanitizer();
  });

  describe("createSanitizer", () => {
    let sanitize: ReturnType<typeof createSanitizer>;

    beforeEach(() => {
      sanitize = createSanitizer();
    });

    it("redacts values when key matches sensitive patterns", () => {
      expect(sanitize("password", "my-password-123")).toBe("***REDACTED***"); // pragma: allowlist secret
      expect(sanitize("secret", "super-secret")).toBe("***REDACTED***"); // pragma: allowlist secret
      expect(sanitize("token", "auth-token")).toBe("***REDACTED***"); // pragma: allowlist secret
      expect(sanitize("apiKey", "key-123")).toBe("***REDACTED***"); // pragma: allowlist secret
      expect(sanitize("api_key", "key-456")).toBe("***REDACTED***"); // pragma: allowlist secret
      expect(sanitize("authorization", "Bearer xyz")).toBe("***REDACTED***"); // pragma: allowlist secret
      expect(sanitize("clientSecret", "secret-abc")).toBe("***REDACTED***"); // pragma: allowlist secret
    });

    it("redacts JWT tokens based on value pattern", () => {
      const jwtToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"; // pragma: allowlist secret

      expect(sanitize("data", jwtToken)).toBe("***REDACTED***");
    });

    it("preserves non-sensitive values", () => {
      expect(sanitize("userId", "user-123")).toBe("user-123");
      expect(sanitize("name", "John Doe")).toBe("John Doe");
      expect(sanitize("count", 42)).toBe(42);
      expect(sanitize("enabled", true)).toBe(true);
    });

    it("handles null and undefined values", () => {
      expect(sanitize("key", null)).toBe(null);
      expect(sanitize("key", undefined)).toBe(undefined);
    });
  });

  describe("addSecretValue", () => {
    it("registers secret values for partial redaction", () => {
      const secret = "my-secret-value"; // pragma: allowlist secret
      addSecretValue(secret);
      const sanitize = createSanitizer();

      expect(sanitize("message", `The secret is ${secret} here`)).toBe(
        "The secret is ***REDACTED*** here",
      );
    });

    it("handles multiple secret values", () => {
      const secretOne = "secret-one"; // pragma: allowlist secret
      const secretTwo = "secret-two"; // pragma: allowlist secret
      addSecretValue(secretOne);
      addSecretValue(secretTwo);
      const sanitize = createSanitizer();

      expect(
        sanitize("message", `Found ${secretOne} and ${secretTwo} in logs`),
      ).toBe("Found ***REDACTED*** and ***REDACTED*** in logs");
    });

    it("handles numeric secret values", () => {
      const pin = 123456; // pragma: allowlist secret
      addSecretValue(pin);
      const sanitize = createSanitizer();

      expect(sanitize("message", `Pin code is ${String(pin)}`)).toBe(
        "Pin code is ***REDACTED***",
      );
    });

    it("ignores null and undefined values", () => {
      addSecretValue(null);
      addSecretValue(undefined);
      const sanitize = createSanitizer();

      expect(sanitize("message", "normal message")).toBe("normal message");
    });

    it("ignores empty string values", () => {
      addSecretValue("");
      addSecretValue("   ");
      const sanitize = createSanitizer();

      expect(sanitize("message", "normal message")).toBe("normal message");
    });

    it("handles special regex characters in secret values", () => {
      const secret = "secret.with+special*chars"; // pragma: allowlist secret
      addSecretValue(secret);
      const sanitize = createSanitizer();

      expect(sanitize("message", `Found ${secret} in text`)).toBe(
        "Found ***REDACTED*** in text",
      );
    });

    it("prefers longer matches when secrets overlap", () => {
      const short = "secret"; // pragma: allowlist secret
      const long = "my-secret-long"; // pragma: allowlist secret
      addSecretValue(short);
      addSecretValue(long);
      const sanitize = createSanitizer();

      expect(sanitize("message", `Value is ${long} here`)).toBe(
        "Value is ***REDACTED*** here",
      );
    });
  });
});
