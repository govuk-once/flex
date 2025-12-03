import { describe, it, expect, vi } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler as getTopicsHandler } from './get';
import { ResponseError } from '@libs/utils';
import { getUserData } from '../../../../services/udp/udp';

vi.mock('../../../../services/udp/udp', async (importActual) => {
  const actual =
    await importActual<typeof import('../../../../services/udp/udp')>();
  return {
    ...actual,
    getUserData: vi.fn(),
  };
});

describe('getTopics handler', () => {
  const mockContext = {
    getRemainingTimeInMillis: null,
  } as unknown as Context;

  it('returns user topics successfully', async () => {
    const mockUserData = {
      userId: 'user-123',
      data: { topic1: 'value1', topic2: 'value2' },
    };

    const event = {
      pathParameters: { userId: 'user-123' },
    } as unknown as APIGatewayProxyEvent;

    vi.mocked(getUserData).mockResolvedValueOnce(mockUserData);

    const result = await getTopicsHandler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(mockUserData);
  });

  describe('non-2XX respones', () => {
    it.each([
      { pathParameters: null },
      { pathParameters: {} },
      { pathParameters: { userId: null } },
      { pathParameters: { userId: undefined } },
      { pathParameters: { userId: '' } },
      { pathParameters: { userId: '     ' } },
    ])('returns 400 when userId is missing or empty', async (event) => {
      getTopicsHandler(event as unknown as APIGatewayProxyEvent, mockContext);
    });

    it.each([
      { statusCode: 404, expectedBody: 'Not Found' },
      { statusCode: 401, expectedBody: 'Unauthorized' },
      { statusCode: 403, expectedBody: 'Forbidden' },
    ])(
      'returns the ResponseError status code and message when a ResponseError is thrown',
      async ({ statusCode, expectedBody }) => {
        const event = {
          pathParameters: { userId: 'non-existent' },
        } as unknown as APIGatewayProxyEvent;

        vi.mocked(getUserData).mockRejectedValueOnce(
          new ResponseError('loggable error message', statusCode),
        );

        const result = await getTopicsHandler(event, mockContext);

        expect(result.statusCode).toBe(statusCode);
        expect(result.body).toBe(expectedBody);
      },
    );

    it('returns a 500 on unexpected errors', async () => {
      const event = {
        pathParameters: { userId: 'non-existent' },
      } as unknown as APIGatewayProxyEvent;

      vi.mocked(getUserData).mockRejectedValueOnce(new Error('generic error'));

      const result = await getTopicsHandler(event, mockContext);

      expect(result.statusCode).toBe(500);
      expect(result.body).toBe('Internal Server Error');
    });
  });
});
