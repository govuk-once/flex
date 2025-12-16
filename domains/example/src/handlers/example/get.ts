import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLambdaHandler } from '@flex/handlers';

/**
 * Lambda handler for GET /example
 * Get hello world from lambda
 */
const handler = createLambdaHandler(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Hello, World!' }),
    };
  },
  {
    loggerOptions: { logLevel: 'INFO', serviceName: 'example-service' },
  },
);

export { handler };
