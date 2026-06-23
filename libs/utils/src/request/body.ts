import type { ZodType } from "zod";
import { ZodError } from "zod";

import { RequestBodyParseError } from "../errors";

export function resolveRequestBody(body: string | null, schema?: ZodType) {
  if (!schema) return;

  let parsedBody: unknown;

  try {
    parsedBody = typeof body === "string" ? JSON.parse(body) : body;
  } catch {
    throw new RequestBodyParseError("Invalid request body");
  }

  try {
    return schema.parse(parsedBody);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new RequestBodyParseError(error.message);
    }

    throw error;
  }
}
