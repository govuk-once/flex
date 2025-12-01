import { describe, it, expect, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { deleteHandler, type DeleteTopicsLambdaDependencies } from './handler';
import {
  createMockUserDataPlatform,
  type MockUserDataPlatform,
} from '../../testing/mocks';

describe('deleteTopics handler', () => {
  let dependencies: DeleteTopicsLambdaDependencies & {
    udpClient: MockUserDataPlatform;
  };
  let deleteTopicsHandler: ReturnType<typeof deleteHandler>;

  const mockContext = {
    getRemainingTimeInMillis: () => 1000,
  } as unknown as Context;

  beforeEach(() => {
    dependencies = {
      udpClient: createMockUserDataPlatform(),
    };
    deleteTopicsHandler = deleteHandler(dependencies);
  });

  it('should delete user topics successfully', async () => {
    dependencies.udpClient.deleteUserData.mockResolvedValue(undefined);

    const event = {
      pathParameters: { userId: 'user-123' },
    } as unknown as APIGatewayProxyEvent;

    const result = await deleteTopicsHandler(event, mockContext);

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe('');
    expect(dependencies.udpClient.deleteUserData).toHaveBeenCalledWith(
      'user-123',
    );
  });

  it('should return 400 when userId is missing', async () => {
    const event = {
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent;

    const result = await deleteTopicsHandler(event, mockContext);

    expect(result.statusCode).toBe(400);
  });

  it('should return 404 when user not found', async () => {
    dependencies.udpClient.deleteUserData.mockRejectedValue(
      new Error('404 Not Found'),
    );

    const event = {
      pathParameters: { userId: 'non-existent' },
    } as unknown as APIGatewayProxyEvent;

    const result = await deleteTopicsHandler(event, mockContext);

    expect(result.statusCode).toBe(404);
  });
});
