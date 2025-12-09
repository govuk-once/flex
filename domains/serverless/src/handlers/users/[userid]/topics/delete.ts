import { STATUS_CODES } from 'http';

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import middy, { MiddyfiedHandler } from '@middy/core';

import { ResponseError } from '@libs/utils';

import { deleteUserData } from '../../../../services/udp/udp';

/**
 * Lambda handler for DELETE /users/{userId}/topics
 * Deletes user topics from the User Data Platform
 */
export const handler = middy<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
>().handler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const userId = event.pathParameters?.userId;

    if (!userId?.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'UserId is required in path' }),
      };
    }

    try {
      await deleteUserData(userId);

      return {
        statusCode: 204,
        body: '',
      };
    } catch (error) {
      console.error('Error deleting topics:', error);

      if (error instanceof ResponseError) {
        return {
          statusCode: error.statusCode,
          body: JSON.stringify({
            error: STATUS_CODES[error.statusCode] ?? 'Error',
          }),
        };
      }

      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  },
);
