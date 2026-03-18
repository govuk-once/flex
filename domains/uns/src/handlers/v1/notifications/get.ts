import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

import { MOCK_NOTIFICATIONS } from "../../../data/notifications";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
>(
  (event): Promise<APIGatewayProxyStructuredResultV2> => {
    const externalUserId = event.queryStringParameters?.["externalUserId"];
    if (!externalUserId) {
      return Promise.resolve({
        statusCode: 400,
        body: JSON.stringify({
          message: "Bad Request: externalUserId is required",
        }),
      });
    }

    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify(MOCK_NOTIFICATIONS),
    });
  },
  { serviceName: "uns-mock-get-notifications", logLevel: "INFO" },
);
