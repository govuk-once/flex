import { randomBytes } from "node:crypto";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SPECIAL = "!@#$%^&*()-_=+[]{}|;:,.<>?";
const CHARSET = UPPER + LOWER + DIGITS + SPECIAL;

export function generatePassword(length = 20): string {
  const mandatory = [
    UPPER[randomBytes(1)[0]! % UPPER.length],
    LOWER[randomBytes(1)[0]! % LOWER.length],
    DIGITS[randomBytes(1)[0]! % DIGITS.length],
    SPECIAL[randomBytes(1)[0]! % SPECIAL.length],
  ];
  const remaining = Array.from(randomBytes(length - mandatory.length)).map(
    (byte) => CHARSET.charAt(byte % CHARSET.length),
  );
  const all = [...mandatory, ...remaining];
  for (let i = all.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0]! % (i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.join("");
}
