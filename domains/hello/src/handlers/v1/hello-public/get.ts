import { createLambdaHandler } from "@flex/handlers";
import { getConfig } from "@flex/params";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import z from "zod";

export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (_event) => {
    const config = await getConfig(
      z.object({
        ENABLED_FEATURE_FLAG: z.string(),
        DISABLED_FEATURE_FLAG: z.string(),
      }),
    );

    return Promise.resolve({
      statusCode: 200,
      body: JSON.stringify({
        message: "Hello public world!",
        featureFlags: {
          enabled: config.featureFlags.ENABLED,
          disabled: config.featureFlags.DISABLED,
        },
      }),
    });
  },
  {
    logLevel: "INFO",
    serviceName: "hello-service",
  },
);
