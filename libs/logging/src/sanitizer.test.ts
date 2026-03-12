import { beforeEach, describe, expect, it, vi } from "vitest";

const REDACTED = "***REDACTED***";

describe("sanitizer", () => {
  let addSecretValue: typeof import("./sanitizer").addSecretValue;
  let sanitize: ReturnType<typeof import("./sanitizer").createSanitizer>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./sanitizer");
    addSecretValue = mod.addSecretValue;
    sanitize = mod.createSanitizer();
  });

  describe("createSanitizer", () => {
    it("redacts values when key matches secret patterns", () => {
      (
        [
          ["password", "my-password-123"], // pragma: allowlist secret
          ["secret", "super-secret"], // pragma: allowlist secret
          ["token", "auth-token"], // pragma: allowlist secret
          ["apiKey", "key-123"], // pragma: allowlist secret
          ["api_key", "key-456"], // pragma: allowlist secret
          ["authorization", "Bearer xyz"], // pragma: allowlist secret
          ["clientSecret", "secret-abc"], // pragma: allowlist secret
        ] as [string, string][]
      ).forEach(([key, value]) => {
        expect(sanitize(key, value)).toBe(REDACTED);
      });
    });

    it("redacts JWT tokens based on value pattern", () => {
      const jwtToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"; // pragma: allowlist secret
      expect(sanitize("data", jwtToken)).toBe(REDACTED);
    });

    it("redacts values when key matches PII patterns", () => {
      (
        [
          ["email", "user@example.com"],
          ["phone", "+447700900000"],
          ["mobile", "07700900000"],
          ["forename", "Jane"],
          ["surname", "Doe"],
          ["firstName", "Jane"],
          ["last_name", "Doe"],
          ["fullName", "Jane Doe"],
          ["date_of_birth", "1990-01-01"],
          ["dob", "1990-01-01"],
          ["nino", "AB123456C"],
          ["national_insurance", "AB123456C"],
          ["postcode", "SW1A 1AA"],
          ["zipCode", "12345"],
          ["sortCode", "12-34-56"],
          ["accountNumber", "12345678"],
          ["ipAddress", "192.168.1.1"],
        ] as [string, string][]
      ).forEach(([key, value]) => {
        expect(sanitize(key, value)).toBe(REDACTED);
      });
    });

    it("redacts PII detected by value patterns", () => {
      [
        "user@example.com",
        "Contact: +447700900000",
        "NI: AB123456C",
        "Post: SW1A 1AA",
        "IP: 192.168.1.1",
      ].forEach((value) => {
        expect(sanitize("data", value)).toBe(REDACTED);
      });
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

      expect(sanitize("message", `The secret is ${secret} here`)).toBe(
        `The secret is ${REDACTED} here`,
      );
    });

    it("handles multiple secret values", () => {
      const secretOne = "secret-one"; // pragma: allowlist secret
      const secretTwo = "secret-two"; // pragma: allowlist secret
      addSecretValue(secretOne);
      addSecretValue(secretTwo);

      expect(
        sanitize("message", `Found ${secretOne} and ${secretTwo} in logs`),
      ).toBe(`Found ${REDACTED} and ${REDACTED} in logs`);
    });

    it("handles numeric secret values", () => {
      const pin = 123456; // pragma: allowlist secret
      addSecretValue(pin);

      expect(sanitize("message", `Pin code is ${String(pin)}`)).toBe(
        `Pin code is ${REDACTED}`,
      );
    });

    it("ignores null and undefined values", () => {
      addSecretValue(null);
      addSecretValue(undefined);

      expect(sanitize("message", "normal message")).toBe("normal message");
    });

    it("ignores empty string values", () => {
      addSecretValue("");
      addSecretValue("   ");

      expect(sanitize("message", "normal message")).toBe("normal message");
    });

    it("handles special regex characters in secret values", () => {
      const secret = "secret.with+special*chars"; // pragma: allowlist secret
      addSecretValue(secret);

      expect(sanitize("message", `Found ${secret} in text`)).toBe(
        `Found ${REDACTED} in text`,
      );
    });

    it("prefers longer matches when secrets overlap", () => {
      const short = "secret"; // pragma: allowlist secret
      const long = "my-secret-long"; // pragma: allowlist secret
      addSecretValue(short);
      addSecretValue(long);

      expect(sanitize("message", `Value is ${long} here`)).toBe(
        `Value is ${REDACTED} here`,
      );
    });
  });

  describe("PII debug toggle", () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
    });

    it("bypasses PII key redaction when FLEX_LOG_PII_DEBUG is true", async () => {
      vi.stubEnv("FLEX_LOG_PII_DEBUG", "true");
      vi.resetModules();
      const mod = await import("./sanitizer");
      const debugSanitize = mod.createSanitizer();

      (
        [
          ["email", "user@example.com"],
          ["phone", "+447700900000"],
          ["forename", "Jane"],
          ["postcode", "SW1A 1AA"],
        ] as [string, string][]
      ).forEach(([key, value]) => {
        expect(debugSanitize(key, value)).toBe(value);
      });
    });

    it("bypasses PII value redaction when FLEX_LOG_PII_DEBUG is true", async () => {
      vi.stubEnv("FLEX_LOG_PII_DEBUG", "true");
      vi.resetModules();
      const mod = await import("./sanitizer");
      const debugSanitize = mod.createSanitizer();

      ["user@example.com", "IP: 192.168.1.1"].forEach((value) => {
        expect(debugSanitize("data", value)).toBe(value);
      });
    });

    it("still redacts secrets when FLEX_LOG_PII_DEBUG is true", async () => {
      vi.stubEnv("FLEX_LOG_PII_DEBUG", "true");
      vi.resetModules();
      const mod = await import("./sanitizer");
      const debugSanitize = mod.createSanitizer();

      expect(debugSanitize("password", "my-password")).toBe(REDACTED); // pragma: allowlist secret
      expect(debugSanitize("token", "auth-token")).toBe(REDACTED); // pragma: allowlist secret
      const jwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"; // pragma: allowlist secret
      expect(debugSanitize("data", jwt)).toBe(REDACTED);
    });

    it("ignores FLEX_LOG_PII_DEBUG in production", async () => {
      vi.stubEnv("FLEX_ENVIRONMENT", "production");
      vi.stubEnv("FLEX_LOG_PII_DEBUG", "true");
      vi.resetModules();
      const mod = await import("./sanitizer");
      const prodSanitize = mod.createSanitizer();

      expect(prodSanitize("email", "user@example.com")).toBe(REDACTED);
      expect(prodSanitize("data", "user@example.com")).toBe(REDACTED);
    });

    it("redacts PII by default when FLEX_LOG_PII_DEBUG is not set", () => {
      expect(sanitize("email", "user@example.com")).toBe(REDACTED);
      expect(sanitize("data", "user@example.com")).toBe(REDACTED);
    });
  });
});
