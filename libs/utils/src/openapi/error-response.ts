import type { ZodOpenApiResponseObject } from "zod-openapi";

import { ErrorResponseSchema } from "../errors/error-response";

export function errorResponse(description: string): ZodOpenApiResponseObject {
  return {
    description,
    content: {
      "application/json": {
        schema: ErrorResponseSchema,
      },
    },
  };
}
