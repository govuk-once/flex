import type { ZodType } from "zod";

import { RequestBodyParseError } from "../errors";

export function resolveRequestBody(body: string | null, schema?: ZodType) {
  if (!schema) return;

  try {
    return schema.parse(typeof body === "string" ? JSON.parse(body) : body);
  } catch {
    throw new RequestBodyParseError("Invalid request body");
  }
}
