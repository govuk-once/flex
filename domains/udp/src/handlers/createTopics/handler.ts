import middy, { MiddyfiedHandler } from '@middy/core';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AuthTokenProviderPort } from '../../domain/ports/AuthTokenProviderPort';
import { ClientCredentialsProvider } from '../../adapters/auth/ClientCredentialsProvider';
import { CreateTopicsUseCase } from '../../application/use-cases/createTopics/CreateTopicsUseCase';
import { UdpHttpClient } from '../../adapters/http/UdpHttpClient';
import { UserDataPlatformPort } from '../../domain/ports/UserDataPlatformPort';
import {
  gobalErrorMiddleware,
  logger,
  MissingBodyError,
  MissingUserIdError,
  generateResponse,
} from '@libs/utils';
import { StatusCodes } from 'http-status-codes';

export interface CreateTopicsLambdaDependencies {
  udpClient: UserDataPlatformPort;
  authProvider: AuthTokenProviderPort;
}

/**
 * Lambda handler for CREATE /users/{userId}/topics
 * Creates user topics from the User Data Platform
 */
export const createHandler = (
  dependencies: CreateTopicsLambdaDependencies,
): MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> =>
  middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(gobalErrorMiddleware(logger)) /** ERROR handling via middy **/
    .handler(
      async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
        const userId = event.pathParameters?.userId;

        // Handle errors
        if (!userId || userId.trim() === '') throw new MissingUserIdError();
        if (!event.body || Object.keys(event.body).length === 0)
          throw new MissingBodyError();

        // Initialise dependencies
        const useCase = new CreateTopicsUseCase(dependencies.udpClient);
        const result = await useCase.execute(userId, JSON.parse(event.body));

        return generateResponse({
          status: StatusCodes.CREATED,
          data: result.data,
        });
      },
    );

/**
 * Lambda handler for PUT /users/{userId}/topics
 * Creates or updates user topics in the User Data Platform
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
