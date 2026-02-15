import z from "zod";

import { parseResponseBody } from "./request";

export async function parseResponseBodyTyped<T>(
  response: Response,
  responseSchema: z.ZodType<T>,
) {
  const raw = await parseResponseBody<unknown>(response);
  const parsed = await responseSchema.parseAsync(raw);
  return {
    data: parsed,
    response,
  };
}
