import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import middy, { MiddyfiedHandler } from '@middy/core';
import { writeUserData } from '../../../../services/udp/udp';
import { STATUS_CODES } from 'http';
import { ResponseError } from '@libs/utils';

/**
 * Lambda handler for CREATE /users/{userId}/topics
 * Creates user topics from the User Data Platform
 */
export const handler = middy<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
>().handler(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const userId = event.pathParameters?.userId;

      if (!userId?.trim()) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'UserId is required in path' }),
        };
      }

      if (!event.body || Object.keys(event.body).length === 0) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Event.body is required' }),
        };
      }

      const result = await writeUserData(userId, JSON.parse(event.body));

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error) {
      console.error('Error creating topics:', error);

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
