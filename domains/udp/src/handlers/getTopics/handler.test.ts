import { describe, it, expect, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { getHandler, type GetTopicsLambdaDependencies } from './handler';
import {
  createMockUserDataPlatform,
  type MockUserDataPlatform,
} from '../../testing/mocks';

describe('getTopics handler', () => {
  let dependencies: GetTopicsLambdaDependencies & {
    udpClient: MockUserDataPlatform;
  };
  let getTopicsHandler: ReturnType<typeof getHandler>;

  const mockContext = {
    getRemainingTimeInMillis: () => 1000,
  } as unknown as Context;

  beforeEach(() => {
    dependencies = {
      udpClient: createMockUserDataPlatform(),
    };
    getTopicsHandler = getHandler(dependencies);
  });

  it('should return user topics successfully', async () => {
    const mockUserData = {
      userId: 'user-123',
      data: { topic1: 'value1', topic2: 'value2' },
    };

    dependencies.udpClient.getUserData.mockResolvedValue(mockUserData);

    const event = {
      pathParameters: { userId: 'user-123' },
    } as unknown as APIGatewayProxyEvent;

    const result = await getTopicsHandler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(mockUserData);
  });

  it('should return 400 when userId is missing', async () => {
    const event = {
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await getTopicsHandler(event, mockContext);

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

    const result = await getTopicsHandler(event, mockContext);

    expect(result.statusCode).toBe(404);
  });

  it('should return 500 on unexpected errors', async () => {
    dependencies.udpClient.getUserData.mockRejectedValue(
      new Error('Unexpected error'),
    );

    const event = {
      pathParameters: { userId: 'user-123' },
    } as unknown as APIGatewayProxyEvent;

    const result = await getTopicsHandler(event, mockContext);

    expect(result.statusCode).toBe(500);
  });
});
