import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createLambdaHandler } from '@flex/handlers';
import { getChildLogger, getLogger } from '../../../../../libs/logging/src';

/**
 * Lambda handler for GET /example
 * Get hello world from lambda
 */
const handler = createLambdaHandler(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    const logger = getLogger();
    const childLogger = getChildLogger({hello: "world"});

    childLogger.info('Processing GET /example request');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Hello, World!' }),
    };
  },
  {
    logLevel: 'INFO',
    serviceName: 'example-service',
  },
);

export { handler };
