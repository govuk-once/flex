import { randomBytes } from "node:crypto";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SPECIAL = "!@#$%^&*()-_=+[]{}|;:,.<>?";
const CHARSET = UPPER + LOWER + DIGITS + SPECIAL;

export function generatePassword(length = 20): string {
  const randomByte = () => randomBytes(1).readUInt8(0);
  const mandatory = [
    UPPER[randomByte() % UPPER.length],
    LOWER[randomByte() % LOWER.length],
    DIGITS[randomByte() % DIGITS.length],
    SPECIAL[randomByte() % SPECIAL.length],
  ];
  const remaining = Array.from(randomBytes(length - mandatory.length)).map(
    (byte) => CHARSET.charAt(byte % CHARSET.length),
  );
  const all = [...mandatory, ...remaining];
  for (let i = all.length - 1; i > 0; i--) {
    const j = randomByte() % (i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.join("");
}
