import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetSettingsUseCase } from '../../application/use-cases/getSettings/GetSettingsUseCase';
import { UdpHttpClient } from '../../adapters/http/UdpHttpClient';
import { ClientCredentialsProvider } from '../../adapters/auth/ClientCredentialsProvider';
import { UserDataPlatformPort } from 'modules/udp/domain/ports/UserDataPlatformPort';
import middy, { MiddyfiedHandler } from '@middy/core';

export interface GetSettingsLambdaDependencies {
  udpClient: UserDataPlatformPort;
}

export const createHandler = (
  dependencies: GetSettingsLambdaDependencies,
): MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> =>
  middy().handler(
    async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      try {
        const userId = event.pathParameters?.userId;

        if (!userId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'UserId is required in path' }),
          };
        }

        const useCase = new GetSettingsUseCase(dependencies.udpClient);
        const result = await useCase.execute(userId);

        return {
          statusCode: 200,
          body: JSON.stringify(result),
        };
      } catch (error) {
        console.error('Error retrieving settings:', error);

        if (error instanceof Error) {
          if (
            error.message.includes('404') ||
            error.message.includes('Not Found')
          ) {
            return {
              statusCode: 404,
              body: JSON.stringify({ error: 'User settings not found' }),
            };
          }
        }

        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        };
      }
    },
  );

const authProvider = new ClientCredentialsProvider({
  tokenEndpoint: process.env.UDP_TOKEN_ENDPOINT || '',
  clientId: process.env.UDP_CLIENT_ID || '',
  clientSecret: process.env.UDP_CLIENT_SECRET || '',
  scope: process.env.UDP_SCOPE || 'udp:read',
});

export const handler = createHandler({
  udpClient: new UdpHttpClient({
    baseUrl: process.env.UDP_BASE_URL || '',
    authTokenProvider: authProvider,
  }),
});
