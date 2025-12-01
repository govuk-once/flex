import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetTopicsUseCase } from '../../application/use-cases/getTopics/GetTopicsUseCase';
import { UdpHttpClient } from '../../adapters/http/UdpHttpClient';
import { ClientCredentialsProvider } from '../../adapters/auth/ClientCredentialsProvider';
import middy, { MiddyfiedHandler } from '@middy/core';
import { ResponseError } from '../../../common/errors/ResponseError';
import { STATUS_CODES } from 'http';

/**
 * Lambda handler for GET /users/{userId}/topics
 * Get user topics from the User Data Platform
 */
export function handler(): MiddyfiedHandler<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
> {
  return middy<APIGatewayProxyEvent, APIGatewayProxyResult>().handler(
    async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const authProvider = new ClientCredentialsProvider({
        tokenEndpoint: process.env.UDP_TOKEN_ENDPOINT || '',
        clientId: process.env.UDP_CLIENT_ID || '',
        clientSecret: process.env.UDP_CLIENT_SECRET || '',
        scope: process.env.UDP_SCOPE || 'udp:read',
      });

      const udpClient = new UdpHttpClient({
        baseUrl: process.env.UDP_BASE_URL || '',
        authTokenProvider: authProvider,
      });

      const userId = event.pathParameters?.userId;

      if (!userId?.trim()) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'UserId is required in path' }),
        };
      }

      try {
        const result = await udpClient.getUserData(userId);

        return {
          statusCode: 200,
          body: JSON.stringify(result),
        };
      } catch (error) {
        console.error('Error retrieving topics:', error);

        if (error instanceof ResponseError) {
          return {
            statusCode: error.statusCode,
            body: JSON.stringify({
              error: STATUS_CODES[error.statusCode] ?? 'Error',
            }),
          };
        }
      }

      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    },
  );
}
