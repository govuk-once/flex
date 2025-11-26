import { describe, it, expect, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import {
  createHandler,
  type DeleteSettingsLambdaDependencies,
} from './handler';
import {
  createMockUserDataPlatform,
  type MockUserDataPlatform,
} from '../../testing/mocks';

describe('deleteSettings handler', () => {
  let dependencies: DeleteSettingsLambdaDependencies & {
    udpClient: MockUserDataPlatform;
  };
  let deleteSettingsHandler: ReturnType<typeof createHandler>;

  const mockContext = {
    getRemainingTimeInMillis: () => 1000,
  } as unknown as Context;

  beforeEach(() => {
    dependencies = {
      udpClient: createMockUserDataPlatform(),
    };
    deleteSettingsHandler = createHandler(dependencies);
  });

  it('should delete user settings successfully', async () => {
    dependencies.udpClient.deleteUserData.mockResolvedValue(undefined);

    const event = {
      pathParameters: { userId: 'user-123' },
    } as unknown as APIGatewayProxyEvent;

    const result = await deleteSettingsHandler(event, mockContext);

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

    const result = await deleteSettingsHandler(event, mockContext);

    expect(result.statusCode).toBe(400);
  });

  it('should return 404 when user not found', async () => {
    dependencies.udpClient.deleteUserData.mockRejectedValue(
      new Error('404 Not Found'),
    );

    const event = {
      pathParameters: { userId: 'non-existent' },
    } as unknown as APIGatewayProxyEvent;

    const result = await deleteSettingsHandler(event, mockContext);

    expect(result.statusCode).toBe(404);
  });
});
