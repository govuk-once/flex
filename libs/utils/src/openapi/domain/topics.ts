import type { ZodOpenApiOperationObject } from "zod-openapi";

import { GetTopicsOutput } from "../../schemas/domain/topics";
import { errorResponse } from "../error-response";

export const getTopics: ZodOpenApiOperationObject = {
  summary: "Get topics",
  description: "Returns a list of topics",
  requestParams: {
    // header: AuthenticatedHeaders,
    // query: GetTopicsInput.shape.query
  },
  responses: {
    200: {
      description: "List of topics",
      content: {
        "application/json": {
          schema: GetTopicsOutput.shape.body,
        },
      },
    },
    400: errorResponse("Invalid query parameters"),
    401: errorResponse("Not authenticated"),
    403: errorResponse("Not authorised to list topics"),
    429: errorResponse("Rate limit exceeded"),
    500: errorResponse("Internal server error"),
  },
};
