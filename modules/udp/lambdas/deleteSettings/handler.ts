import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteSettingsUseCase } from '../../application/use-cases/deleteSettings/DeleteSettingsUseCase';
import { UdpHttpClient } from '../../adapters/http/UdpHttpClient';
import { ClientCredentialsProvider } from '../../adapters/auth/ClientCredentialsProvider';
import { UserDataPlatformPort } from 'modules/udp/domain/ports/UserDataPlatformPort';

export interface DeleteSettingsLambdaDependencies {
  udpClient: UserDataPlatformPort;
}

/**
 * Lambda handler for DELETE /settings/{userId}
 * Deletes user settings from the User Data Platform
 */
export const createHandler =
  (dependencies: DeleteSettingsLambdaDependencies) =>
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const userId = event.pathParameters?.userId;

      if (!userId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'UserId is required in path' }),
        };
      }

      const useCase = new DeleteSettingsUseCase(dependencies.udpClient);
      await useCase.execute(userId);

      return {
        statusCode: 204,
        body: '',
      };
    } catch (error) {
      console.error('Error deleting settings:', error);

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
  };

const deleteAuthProvider = new ClientCredentialsProvider({
  tokenEndpoint: process.env.UDP_TOKEN_ENDPOINT || '',
  clientId: process.env.UDP_CLIENT_ID || '',
  clientSecret: process.env.UDP_CLIENT_SECRET || '',
  scope: process.env.UDP_SCOPE || 'udp:write',
});

export const handler = createHandler({
  udpClient: new UdpHttpClient({
    baseUrl: process.env.UDP_BASE_URL || '',
    authTokenProvider: deleteAuthProvider,
  }),
});
