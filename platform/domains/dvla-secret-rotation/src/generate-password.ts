import { randomBytes } from "node:crypto";

const CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generatePassword(length = 20): string {
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((byte) => CHARSET.charAt(byte % CHARSET.length))
    .join("");
}
