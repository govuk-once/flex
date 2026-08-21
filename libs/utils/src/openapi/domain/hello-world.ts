import type { ZodOpenApiOperationObject } from "zod-openapi";

import { HelloWorldOutput } from "../../schemas/domain/hello-world";
import { errorResponse } from "../error-response";

export const getHelloWorld: ZodOpenApiOperationObject = {
  summary: "Hello world",
  description: "Returns a message",
  requestParams: {
    // header: AuthenticatedHeaders,
    // query: HelloWorldInput.shape.query
  },
  responses: {
    200: {
      description: "Returns a message",
      content: {
        "application/json": {
          schema: HelloWorldOutput.shape.body,
        },
      },
    },
    400: errorResponse("Invalid query parameters"),
    401: errorResponse("Not authenticated"),
    403: errorResponse("Not authorised to view this resource"),
    429: errorResponse("Rate limit exceeded"),
    500: errorResponse("Internal server error"),
  },
};
