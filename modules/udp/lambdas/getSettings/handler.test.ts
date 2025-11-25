import { describe, it, expect, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { createHandler, type GetSettingsLambdaDependencies } from './handler';
import {
  createMockUserDataPlatform,
  type MockUserDataPlatform,
} from '../../testing/mocks';

describe('getSettings handler', () => {
  let dependencies: GetSettingsLambdaDependencies & {
    udpClient: MockUserDataPlatform;
  };
  let getSettingsHandler: ReturnType<typeof createHandler>;

  beforeEach(() => {
    dependencies = {
      udpClient: createMockUserDataPlatform(),
    };
    getSettingsHandler = createHandler(dependencies);
  });

  it('should return user settings successfully', async () => {
    const mockUserData = {
      userId: 'user-123',
      data: { theme: 'dark', notifications: true },
    };

    dependencies.udpClient.getUserData.mockResolvedValue(mockUserData);

    const event = {
      pathParameters: { userId: 'user-123' },
    } as unknown as APIGatewayProxyEvent;

    const result = await getSettingsHandler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(mockUserData);
  });

  it('should return 400 when userId is missing', async () => {
    const event = {
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await getSettingsHandler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error');
  });

  it('should return 404 when user not found', async () => {
    dependencies.udpClient.getUserData.mockRejectedValue(
      new Error('404 Not Found'),
    );

    const event = {
      pathParameters: { userId: 'non-existent' },
    } as unknown as APIGatewayProxyEvent;

    const result = await getSettingsHandler(event);

    expect(result.statusCode).toBe(404);
  });

  it('should return 500 on unexpected errors', async () => {
    dependencies.udpClient.getUserData.mockRejectedValue(
      new Error('Unexpected error'),
    );

    const event = {
      pathParameters: { userId: 'user-123' },
    } as unknown as APIGatewayProxyEvent;

    const result = await getSettingsHandler(event);

    expect(result.statusCode).toBe(500);
  });
});
