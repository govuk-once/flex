import { describe, it, expect, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { InMemoryUdpStore } from './InMemoryUdpStore';
import { createUdpStubHandler } from './handler';

const createEvent = (
  overrides: Partial<APIGatewayProxyEvent>,
): APIGatewayProxyEvent =>
  ({
    resource: '/users/{userId}',
    path: '/users/user-123',
    httpMethod: 'GET',
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: { userId: 'user-123' },
    stageVariables: null,
    requestContext: {} as unknown,
    body: null,
    isBase64Encoded: false,
    ...overrides,
  }) as APIGatewayProxyEvent;

describe('UDP stub handler', () => {
  let store: InMemoryUdpStore;
  let handler: ReturnType<typeof createUdpStubHandler>;

  beforeEach(() => {
    store = new InMemoryUdpStore([
      {
        userId: 'user-123',
        data: { topics: ['alpha', 'beta'] },
      },
    ]);
    handler = createUdpStubHandler({ store });
  });

  it('returns existing user topics for GET', async () => {
    const result = await handler(createEvent({ httpMethod: 'GET' }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      userId: 'user-123',
      data: { topics: ['alpha', 'beta'] },
    });
  });

  it('returns 404 when user is missing on GET', async () => {
    const event = createEvent({
      pathParameters: { userId: 'missing' },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
  });

  it('creates or updates topics on PUT', async () => {
    const event = createEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({ data: { interests: ['movies'] } }),
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      userId: 'user-123',
      data: { interests: ['movies'] },
    });
  });

  it('returns 400 for PUT with invalid payload', async () => {
    const event = createEvent({
      httpMethod: 'PUT',
      body: JSON.stringify({ data: null }),
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when PUT body is missing', async () => {
    const event = createEvent({
      httpMethod: 'PUT',
      body: null,
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error');
  });

  it('returns 400 when PUT body is invalid JSON', async () => {
    const event = createEvent({
      httpMethod: 'PUT',
      body: '{ invalid }',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toHaveProperty('error');
  });

  it('deletes user topics on DELETE', async () => {
    const event = createEvent({
      httpMethod: 'DELETE',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(204);
    expect(result.body).toBe('');
  });

  it('returns 404 when deleting missing user', async () => {
    const event = createEvent({
      httpMethod: 'DELETE',
      pathParameters: { userId: 'missing' },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(404);
  });

  it('rejects unsupported methods', async () => {
    const event = createEvent({
      httpMethod: 'POST',
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(405);
  });

  it('validates that userId path parameter is provided', async () => {
    const event = createEvent({
      pathParameters: null,
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/userId/);
  });
});
