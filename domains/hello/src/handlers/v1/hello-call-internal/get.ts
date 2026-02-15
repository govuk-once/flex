import { createLambdaHandler } from "@flex/handlers";
import { getConfig } from "@flex/params";
import { sigv4Fetch } from "@flex/utils";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";

const configSchema = z.looseObject({
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

    const response = await sigv4Fetch({
      region: config.AWS_REGION,
      baseUrl: baseUrl.toString(),
      method: "GET",
      path: "/domains/hello/v1/hello-internal",
    });

    const body = await response.text();
    let parsedBody: Record<string, unknown> = { message: "Access denied by private API gateway" };
    if (body) {
      try {
        parsedBody = JSON.parse(body) as Record<string, unknown>;
      } catch {
        parsedBody = { message: body };
      }
    }

    return {
      statusCode: response.status,
      body: JSON.stringify({ ...parsedBody, status: response.status }),
    };
  },
  {
    logLevel: "INFO",
    serviceName: "hello-call-internal-service",
  },
);
