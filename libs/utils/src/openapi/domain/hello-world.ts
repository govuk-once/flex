import type { ZodOpenApiOperationObject } from "zod-openapi";

import { HelloWorldOutput } from "../../schemas/domain/hello-world";

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
    400: {
      description: "Invalid query parameters",
    },
    401: {
      description: "Not authenticated",
    },
    403: {
      description: "Not authorised to view this resource",
    },
    429: {
      description: "Rate limit exceeded",
    },
    500: {
      description: "Internal server error",
    },
  },
};
