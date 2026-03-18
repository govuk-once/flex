import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

import { MOCK_NOTIFICATIONS } from "../../../../../data/notifications";
import { PatchNotificationBodySchema } from "../../../../../schemas/notification";

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

    const rawBody: unknown = event.body
      ? (JSON.parse(event.body) as unknown)
      : undefined;

    const parsed = PatchNotificationBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Bad Request: invalid body" }),
      };
    }

    const exists = MOCK_NOTIFICATIONS.some(
      (n) => n.NotificationID === notificationId,
    );

    if (!exists) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
      };
    }

    return {
      statusCode: 202,
      body: "",
    };
  },
  { serviceName: "uns-mock-patch-notification-status", logLevel: "INFO" },
);
