import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CreateSettingsUseCase } from '../../application/use-cases/createSettings/CreateSettingsUseCase';
import { UdpHttpClient } from '../../adapters/http/UdpHttpClient';
import { ClientCredentialsProvider } from '../../adapters/auth/ClientCredentialsProvider';
import { UserDataPlatformPort } from 'modules/udp/domain/ports/UserDataPlatformPort';
import { AuthTokenProviderPort } from 'modules/udp/domain/ports/AuthTokenProviderPort';

export interface CreateSettingsLambdaDependencies {
  udpClient: UserDataPlatformPort;
  authProvider: AuthTokenProviderPort;
}

export const createHandler =
  (dependencies: CreateSettingsLambdaDependencies) =>
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const userId = event.pathParameters?.userId;

      // Initialize dependencies
      const useCase = new CreateSettingsUseCase(dependencies.udpClient);
      const result = await useCase.execute(userId, JSON.parse(event.body));

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error) {
      console.error('Error creating settings:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  };

/**
 * Lambda handler for PUT /settings/{userId}
 * Creates or updates user settings in the User Data Platform
 */
export const handler = createHandler({
  udpClient: new UdpHttpClient({
    baseUrl: process.env.UDP_BASE_URL || '',
    authTokenProvider: new ClientCredentialsProvider({
      tokenEndpoint: process.env.UDP_TOKEN_ENDPOINT || '',
      clientId: process.env.UDP_CLIENT_ID || '',
      clientSecret: process.env.UDP_CLIENT_SECRET || '',
      scope: process.env.UDP_SCOPE || 'udp:write',
    }),
  }),
  authProvider: new ClientCredentialsProvider({
    tokenEndpoint: process.env.UDP_TOKEN_ENDPOINT || '',
    clientId: process.env.UDP_CLIENT_ID || '',
    clientSecret: process.env.UDP_CLIENT_SECRET || '',
    scope: process.env.UDP_SCOPE || 'udp:write',
  }),
});
