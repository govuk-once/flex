import { createSigv4Fetcher } from "@flex/flex-fetch";
import { createLambdaHandler } from "@flex/handlers";
import { getConfig } from "@flex/params";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";

const configSchema = z.object({
  FLEX_PRIVATE_GATEWAY_URL_PARAM_NAME: z.string().min(1),
  AWS_REGION: z.string().min(1),
});

/**
 * Caller lambda that attempts to call the private hello-internal endpoint.
 * This lambda has NO permissions to call /domains/hello/v1/hello-internal,
 * so the private API gateway will return 403 Forbidden.
 */
export const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (_event) => {
    const config = await getConfig(configSchema);
    const baseUrl = new URL(config.FLEX_PRIVATE_GATEWAY_URL);

    const fetcher = createSigv4Fetcher({
      region: config.AWS_REGION,
      baseUrl: baseUrl.toString(),
    });

    const { request } = fetcher("/domains/hello/v1/hello-internal");
    const response = await request;
    const body = (await response.json()) as Record<string, unknown>;
    return {
      statusCode: response.status,
      body: JSON.stringify(body),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "hello-call-internal-service",
  },
);
