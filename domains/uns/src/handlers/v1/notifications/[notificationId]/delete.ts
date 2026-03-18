import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

import { MOCK_NOTIFICATIONS } from "../../../../data/notifications";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
>(
  (event): Promise<APIGatewayProxyStructuredResultV2> => {
    const notificationId = event.pathParameters?.["notificationId"];
    if (!notificationId) {
      return Promise.resolve({
        statusCode: 400,
        body: JSON.stringify({
          message: "Bad Request: notificationId is required",
        }),
      });
    }

    const exists = MOCK_NOTIFICATIONS.some(
      (n) => n.NotificationID === notificationId,
    );

    if (!exists) {
      return Promise.resolve({
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
      });
    }

    return Promise.resolve({
      statusCode: 204,
      body: "",
    });
  },
  { serviceName: "uns-mock-delete-notification", logLevel: "INFO" },
);
