import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from 'aws-lambda';

/**
 * Simple hello world Lambda handler
 */
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod;
  const path = event.path;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Hello from Lambda2!',
      method,
      path,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    }),
  };
};

