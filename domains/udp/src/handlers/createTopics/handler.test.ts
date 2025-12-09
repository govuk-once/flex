import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createHandler, CreateTopicsLambdaDependencies } from './handler';
import { UserDataPlatformPort } from '../../domain/ports/UserDataPlatformPort';
import { UserDataResponse } from '../../domain/models/UserData';
import { AuthTokenProviderPort } from '../../domain/ports/AuthTokenProviderPort';
import { StatusCodes } from 'http-status-codes';

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

    expect(result.statusCode).toBe(StatusCodes.CREATED);
    expect(JSON.parse(result.body)).toEqual({
      data: { topic1: 'value1', topic2: 'value2' },
    });
  });

  it('should create handle invalid user id', async () => {
    const event: APIGatewayProxyEvent = {
      pathParameters: { userId: ' ' },
      body: JSON.stringify({ topic1: 'value1', topic2: 'value2' }),
    } as unknown as APIGatewayProxyEvent;

    const result = await mockHandler(event, mockContext);

    expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);
    expect(JSON.parse(result.body)).toEqual({ message: 'Bad Request' });
  });
});
