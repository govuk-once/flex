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

    const notification = MOCK_NOTIFICATIONS.find(
      (n) => n.NotificationID === notificationId,
    );

    if (!notification) {
      return Promise.resolve({
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
      });
    }

    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify(notification),
    });
  },
  { serviceName: "uns-mock-get-notification-by-id", logLevel: "INFO" },
);
