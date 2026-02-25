import { describe, expect, it } from "vitest";

import { LogSanitizer } from "./sanitizer";

const REDACTED = "***secret-value***";

describe("LogSanitizer", () => {
  describe("key pattern matching", () => {
    it("redacts keys matching a string pattern (case-insensitive substring)", () => {
      const sanitizer = new LogSanitizer({ keyPatterns: ["secret"] });
      const replacer = sanitizer.createReplacer();
      const input = { notificationSecretKey: "my-secret-value" }; // pragma: allowlist secret

      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.notificationSecretKey).toBe(REDACTED);
    });

    it("redacts keys matching a regex pattern", () => {
      const sanitizer = new LogSanitizer({ keyPatterns: [/^FLEX_/] });
      const replacer = sanitizer.createReplacer();
      const input = { FLEX_UDP_NOTIFICATION_SECRET: "some-value", other: "ok" }; // pragma: allowlist secret
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.FLEX_UDP_NOTIFICATION_SECRET).toBe(REDACTED);
      expect(result.other).toBe("ok");
    });

    it("matches string patterns case-insensitively", () => {
      const sanitizer = new LogSanitizer({ keyPatterns: ["password"] });
      const replacer = sanitizer.createReplacer();

      const input = { PASSWORD: "abc", userPassword: "def", pass: "ghi" };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.PASSWORD).toBe(REDACTED);
      expect(result.userPassword).toBe(REDACTED);
      expect(result.pass).toBe("ghi");
    });
  });

  describe("value pattern matching", () => {
    it("redacts string values matching a regex pattern", () => {
      const sanitizer = new LogSanitizer({
        valuePatterns: [/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/],
      });
      const replacer = sanitizer.createReplacer();

      const input = {
        token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0", // pragma: allowlist secret
        name: "safe-value",
      };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.token).toBe(REDACTED);
      expect(result.name).toBe("safe-value");
    });

    it("redacts string values matching a string pattern", () => {
      const sanitizer = new LogSanitizer({
        valuePatterns: ["Bearer"],
      });
      const replacer = sanitizer.createReplacer();

      const input = { auth: "Bearer abc123", other: "hello" };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.auth).toBe(REDACTED);
      expect(result.other).toBe("hello");
    });

    it("does not test non-string values against value patterns", () => {
      const sanitizer = new LogSanitizer({ valuePatterns: [/123/] });
      const replacer = sanitizer.createReplacer();

      const input = { count: 123, flag: true, label: "abc123" };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.count).toBe(123);
      expect(result.flag).toBe(true);
      expect(result.label).toBe(REDACTED);
    });
  });

  describe("nested objects and arrays", () => {
    it("sanitizes keys in nested objects", () => {
      const sanitizer = new LogSanitizer({ keyPatterns: ["secret"] });
      const replacer = sanitizer.createReplacer();

      const input = {
        level1: {
          level2: {
            secretKey: "hidden", // pragma: allowlist secret
            safeKey: "visible",
          },
        },
      };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.level1.level2.secretKey).toBe(REDACTED);
      expect(result.level1.level2.safeKey).toBe("visible");
    });

    it("sanitizes objects inside arrays", () => {
      const sanitizer = new LogSanitizer({ keyPatterns: ["token"] });
      const replacer = sanitizer.createReplacer();

      const input = {
        items: [
          { token: "abc", id: 1 },
          { token: "def", id: 2 },
        ],
      };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.items.at(0)?.token).toBe(REDACTED);
      expect(result.items.at(0)?.id).toBe(1);
      expect(result.items.at(1)?.token).toBe(REDACTED);
      expect(result.items.at(1)?.id).toBe(2);
    });
  });

  describe("empty patterns", () => {
    it("passes all values through when no patterns are provided", () => {
      const sanitizer = new LogSanitizer();
      const replacer = sanitizer.createReplacer();
      const input = { secret: "value", token: "abc", password: "123" }; // pragma: allowlist secret
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result).toEqual(input);
    });
  });

  describe("mixed patterns", () => {
    it("handles a mix of string and regex patterns", () => {
      const sanitizer = new LogSanitizer({
        keyPatterns: ["password", /^api_/i],
      });
      const replacer = sanitizer.createReplacer();

      const input = {
        password: "hidden", // pragma: allowlist secret
        API_KEY: "hidden-too", // pragma: allowlist secret
        username: "visible",
      };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.password).toBe(REDACTED);
      expect(result.API_KEY).toBe(REDACTED);
      expect(result.username).toBe("visible");
    });
  });

  describe("parseStringifiedJson", () => {
    it("does not parse stringified JSON by default", () => {
      const sanitizer = new LogSanitizer({ keyPatterns: ["secret"] });
      const replacer = sanitizer.createReplacer();

      const jsonString = JSON.stringify({ secret: "hidden" });
      const input = { body: jsonString };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.body).toBe(jsonString);
    });

    it("parses and sanitizes stringified JSON when enabled", () => {
      const sanitizer = new LogSanitizer({
        keyPatterns: ["secret"],
        parseStringifiedJson: true,
      });
      const replacer = sanitizer.createReplacer();

      const jsonString = JSON.stringify({
        secret: "hidden", // pragma: allowlist secret
        safe: "visible",
      });
      const input = { body: jsonString };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      const parsedBody = JSON.parse(result.body) as {
        secret: string;
        safe: string;
      };
      expect(parsedBody.secret).toBe(REDACTED);
      expect(parsedBody.safe).toBe("visible");
    });

    it("leaves invalid JSON strings untouched when parseStringifiedJson is enabled", () => {
      const sanitizer = new LogSanitizer({
        keyPatterns: ["secret"],
        parseStringifiedJson: true,
      });
      const replacer = sanitizer.createReplacer();

      const input = { message: "not a json {string", count: "42" };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.message).toBe("not a json {string");
      expect(result.count).toBe("42");
    });

    it("leaves primitive JSON strings untouched", () => {
      const sanitizer = new LogSanitizer({
        keyPatterns: ["secret"],
        parseStringifiedJson: true,
      });
      const replacer = sanitizer.createReplacer();

      const input = { value: '"just a string"' };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.value).toBe('"just a string"');
    });
  });

  describe("addSecretValue", () => {
    it("redacts exact secret values added at runtime", () => {
      const sanitizer = new LogSanitizer();
      sanitizer.addSecretValue("super-secret-api-key-12345");
      const replacer = sanitizer.createReplacer();
      const input = { apiKey: "super-secret-api-key-12345", name: "visible" }; // pragma: allowlist secret
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.apiKey).toBe(REDACTED);
      expect(result.name).toBe("visible");
    });

    it("redacts when secret value appears as substring", () => {
      const sanitizer = new LogSanitizer();
      sanitizer.addSecretValue("secret-value-xyz");
      const replacer = sanitizer.createReplacer();

      const input = { message: "Error with secret-value-xyz in request" };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.message).toBe(REDACTED);
    });

    it("redacts secrets added after replacer was created", () => {
      const sanitizer = new LogSanitizer();
      const replacer = sanitizer.createReplacer();

      sanitizer.addSecretValue("late-added-secret-value");

      const input = { data: "late-added-secret-value" };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.data).toBe(REDACTED);
    });

    it("redacts in nested objects", () => {
      const sanitizer = new LogSanitizer();
      sanitizer.addSecretValue("nested-secret-value");
      const replacer = sanitizer.createReplacer();

      const input = { level1: { level2: { field: "nested-secret-value" } } };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.level1.level2.field).toBe(REDACTED);
    });
  });

  describe("key and value patterns combined", () => {
    it("redacts by key even if value does not match value patterns", () => {
      const sanitizer = new LogSanitizer({
        keyPatterns: ["secret"],
        valuePatterns: [/^eyJ/],
      });
      const replacer = sanitizer.createReplacer();

      const input = {
        secretKey: "plain-text", // pragma: allowlist secret
        jwt: "eyJhbGciOiJIUzI1NiJ9.test", // pragma: allowlist secret
      };
      const result = JSON.parse(
        JSON.stringify(input, replacer),
      ) as typeof input;

      expect(result.secretKey).toBe(REDACTED);
      expect(result.jwt).toBe(REDACTED);
    });
  });
});
