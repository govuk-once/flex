import type { ZodOpenApiOperationObject } from 'zod-openapi';

import { GetTopicsOutput } from '../../schemas/domain/topics';

export const getTopics: ZodOpenApiOperationObject = {
  summary: 'Get topics',
  description: 'Returns a list of topics',
  requestParams: {
    // header: AuthenticatedHeaders,
    // query: GetTopicsInput.shape.query
  },
  responses: {
    200: {
      description: 'List of topics',
      content: {
        'application/json': {
          schema: GetTopicsOutput.shape.body,
        },
      },
    },
    400: {
      description: 'Invalid query parameters',
    },
    401: {
      description: 'Not authenticated',
    },
    403: {
      description: 'Not authorised to list topics',
    },
    429: {
      description: 'Rate limit exceeded',
    },
    500: {
      description: 'Internal server error',
    },
  },
};
