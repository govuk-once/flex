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
  (event): Promise<APIGatewayProxyResultV2> => {
    const apiKey = event.headers["x-api-key"];
    if (!apiKey || apiKey !== process.env["UNS_MOCK_API_KEY"]) {
      return Promise.resolve({
        statusCode: 401,
        body: JSON.stringify({ message: "Unauthorized" }),
      });
    }

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
