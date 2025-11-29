import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createHandler, CreateTopicsLambdaDependencies } from './handler';
import { UserDataPlatformPort } from 'modules/udp/domain/ports/UserDataPlatformPort';
import { UserDataResponse } from 'modules/udp/domain/models/UserData';
import { AuthTokenProviderPort } from 'modules/udp/domain/ports/AuthTokenProviderPort';

describe('createTopics handler', () => {
  class MockUdpHttpClient implements UserDataPlatformPort {
    getUserData(userId: string): Promise<UserDataResponse> {
      return Promise.resolve({
        userId,
        data: { theme: 'light', language: 'en' },
      });
    }
    writeUserData(
      userId: string,
      data: Record<string, unknown>,
    ): Promise<UserDataResponse> {
      return Promise.resolve({
        userId,
        data,
      });
    }
    deleteUserData(): Promise<void> {
      return Promise.resolve();
    }
  }

  class MockAuthTokenProvider implements AuthTokenProviderPort {
    getAccessToken(): Promise<string> {
      return Promise.resolve('mock-token');
    }
  }

  const mockUdpClient = new MockUdpHttpClient();

  const mockAuthProvider = new MockAuthTokenProvider();

  const createMockDependencies = (): CreateTopicsLambdaDependencies => {
    return {
      udpClient: mockUdpClient,
      authProvider: mockAuthProvider,
    };
  };

  const mockHandler = createHandler(createMockDependencies());

  const mockContext = {
    getRemainingTimeInMillis: () => 1000,
  } as unknown as Context;

  it('should create user topics successfully', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: { userId: 'user-123' },
      body: JSON.stringify({ topic1: 'value1', topic2: 'value2' }),
    } as unknown as APIGatewayProxyEvent;

    const result = await mockHandler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      userId: 'user-123',
      data: { topic1: 'value1', topic2: 'value2' },
    });
  });
});
