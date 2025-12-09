import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteTopicsUseCase } from '../../application/use-cases/deleteTopics/DeleteTopicsUseCase';
import { UdpHttpClient } from '../../adapters/http/UdpHttpClient';
import { ClientCredentialsProvider } from '../../adapters/auth/ClientCredentialsProvider';
import { UserDataPlatformPort } from '../../domain/ports/UserDataPlatformPort';
import middy, { MiddyfiedHandler } from '@middy/core';
import {
  generateResponse,
  gobalErrorMiddleware,
  logger,
  MissingUserIdError,
} from '@libs/utils';
import { StatusCodes } from 'http-status-codes';

export interface DeleteTopicsLambdaDependencies {
  udpClient: UserDataPlatformPort;
}

/**
 * Lambda handler for DELETE /users/{userId}/topics
 * Deletes user topics from the User Data Platform
 */
export const deleteHandler = (
  dependencies: DeleteTopicsLambdaDependencies,
): MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> =>
  middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(gobalErrorMiddleware(logger)) /** ERROR handling via middy **/
    .handler(
      async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
        const userId = event.pathParameters?.userId;

        // Handle errors
        if (!userId || userId.trim() === '') throw new MissingUserIdError();

        // Initialise dependencies
        const useCase = new DeleteTopicsUseCase(dependencies.udpClient);
        await useCase.execute(userId);

        return generateResponse({
          status: StatusCodes.NO_CONTENT,
          data: '',
        });
      },
    );

const deleteAuthProvider = new ClientCredentialsProvider({
  tokenEndpoint: process.env.UDP_TOKEN_ENDPOINT || '',
  clientId: process.env.UDP_CLIENT_ID || '',
  clientSecret: process.env.UDP_CLIENT_SECRET || '',
  scope: process.env.UDP_SCOPE || 'udp:write',
});

export const handler = deleteHandler({
  udpClient: new UdpHttpClient({
    baseUrl: process.env.UDP_BASE_URL || '',
    authTokenProvider: deleteAuthProvider,
  }),
});
