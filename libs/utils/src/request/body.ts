import type { z } from "zod";
import { ZodError } from "zod";

import { RequestBodyParseError } from "../errors";

export function resolveRequestBody<T extends z.ZodType>(
  body: string | null,
  schema?: T,
): z.output<T> | undefined {
  if (!schema) return;

  try {
    return schema.parse(body ? JSON.parse(body) : undefined);
  } catch (error) {
    throw new RequestBodyParseError(
      error instanceof ZodError ? error.message : "Invalid request body",
    );
  }
}
