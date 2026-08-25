import { describe, expect, it } from "vitest";

import { generatePassword } from "./generate-password";

describe("generatePassword", () => {
  it("generates a password of the specified length", () => {
    const password = generatePassword(20);
    expect(password).toHaveLength(20);
  });

  it("defaults to 20 characters", () => {
    const password = generatePassword();
    expect(password).toHaveLength(20);
  });

  it("contains only alphanumeric characters", () => {
    const password = generatePassword(100);
    expect(password).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("generates different passwords on each call", () => {
    const passwords = new Set(
      Array.from({ length: 10 }, () => generatePassword(20)),
    );
    expect(passwords.size).toBe(10);
  });
});
