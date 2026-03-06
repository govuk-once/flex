import type { BinaryToTextEncoding } from "node:crypto";
import crypto from "node:crypto";

interface CreateHashOptions {
  algorithm?: string;
  encoding?: BinaryToTextEncoding;
  start?: number;
  end?: number;
}

export function createHash(
  value: string,
  {
    algorithm = "md5",
    encoding = "hex",
    start = 0,
    end = 16,
  }: CreateHashOptions = {},
) {
  return crypto
    .createHash(algorithm)
    .update(value)
    .digest(encoding)
    .slice(start, end);
}
