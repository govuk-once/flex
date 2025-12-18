import { describe, it, expect } from 'vitest';
import { handler } from './handler';
import type { APIGatewayProxyEvent } from 'aws-lambda';

describe('Hello Lambda Handler', () => {
  it('should return a successful response', async () => {
    const event: APIGatewayProxyEvent = {
      httpMethod: 'GET',
      path: '/hello',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      headers: {},
      multiValueHeaders: {},
      body: null,
      isBase64Encoded: false,
      requestContext: {
        authorizer: null,
        accountId: '123456789012',
        apiId: 'test-api-id',
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        path: '/hello',
        stage: 'test',
        requestId: 'test-request-id',
        requestTime: '09/Apr/2015:12:34:56 +0000',
        requestTimeEpoch: 1428582896000,
        resourceId: 'test-resource-id',
        resourcePath: '/hello',
        identity: {
          accessKey: null,
          accountId: null,
          apiKey: null,
          apiKeyId: null,
          caller: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          sourceIp: '127.0.0.1',
          user: null,
          userAgent: 'test-agent',
          userArn: null,
          clientCert: null,
        },
      },
      resource: '/hello',
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(result.headers?.['Content-Type']).toBe('application/json');

    const body = JSON.parse(result.body);
    expect(body.message).toBe('Hello from Lambda!');
    expect(body.method).toBe('GET');
    expect(body.path).toBe('/hello');
    expect(body.timestamp).toBeDefined();
  });
});

