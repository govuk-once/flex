import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { createHandler, CreateSettingsLambdaDependencies } from './handler';
import { UserDataPlatformPort } from 'modules/udp/domain/ports/UserDataPlatformPort';
import { UserDataResponse } from 'modules/udp/domain/models/UserData';
import { AuthTokenProviderPort } from 'modules/udp/domain/ports/AuthTokenProviderPort';

describe('createSettings handler', () => {
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

  const createMockDependencies = (): CreateSettingsLambdaDependencies => {
    return {
      udpClient: mockUdpClient,
      authProvider: mockAuthProvider,
    };
  };

  const mockHandler = createHandler(createMockDependencies());

  it('should create user settings successfully', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: { userId: 'user-123' },
      body: JSON.stringify({ theme: 'light', language: 'en' }),
    } as unknown as APIGatewayProxyEvent;

    const result = await mockHandler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      userId: 'user-123',
      data: { theme: 'light', language: 'en' },
    });
  });
});
