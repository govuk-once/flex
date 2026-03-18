import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

import { MOCK_NOTIFICATIONS } from "../../../../data/notifications";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (event) => {
    const apiKey = event.headers?.["x-api-key"];
    if (!apiKey || apiKey !== process.env["UNS_MOCK_API_KEY"]) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    const notificationId = event.pathParameters?.["notificationId"];
    if (!notificationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Bad Request: notificationId is required" }),
      };
    }

    const notification = MOCK_NOTIFICATIONS.find(
      (n) => n.NotificationID === notificationId,
    );

    if (!notification) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(notification),
    };
  },
  { serviceName: "uns-mock-get-notification-by-id", logLevel: "INFO" },
);
