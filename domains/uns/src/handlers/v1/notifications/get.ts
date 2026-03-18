import { createLambdaHandler } from "@flex/handlers";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

import { MOCK_NOTIFICATIONS } from "../../../data/notifications";

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

    const externalUserId = event.queryStringParameters?.["externalUserId"];
    if (!externalUserId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Bad Request: externalUserId is required" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(MOCK_NOTIFICATIONS),
    };
  },
  { serviceName: "uns-mock-get-notifications", logLevel: "INFO" },
);
