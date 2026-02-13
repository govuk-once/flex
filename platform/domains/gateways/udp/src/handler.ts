import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { getConfig } from "@flex/params";
import { jsonResponse, parseResponseBody } from "@flex/utils";
import { sigv4FetchWithCredentials } from "@flex/utils";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import status from "http-status";
import { z } from "zod";

import { matchRemoteRoute } from "./routes";

const configSchema = z.object({
  AWS_REGION: z.string().min(1),
  FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN_PARAM_NAME: z.string().min(1),
});

const consumerConfigSchema = z.object({
  region: z.string().min(1),
  apiAccountId: z.string().min(1),
  apiUrl: z.string().min(1),
  consumerRoleArn: z.string().min(1),
  externalId: z.string().optional(),
});

type ConsumerConfig = z.output<typeof consumerConfigSchema>;

async function getConsumerConfig(secretArn: string): Promise<ConsumerConfig> {
  const config = await getSecret(secretArn);
  if (!config) {
    throw new Error("Consumer config not found");
  }
  return consumerConfigSchema.parse(JSON.parse(config));
}

const SERVICE_NAME = "app";

/**
 * UDP connector (service gateway) – internal-only, invoked via the private API gateway.
 *
 * Follows the plan: receives validated request body, (future: calls remote UDP API with
 * credentials/ACL), returns mapped response. No direct invocation from domain lambdas.
 */
const handler = createLambdaHandler<
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2,
  Context
>(
  async (event) => {
    const logger = getLogger();
    const config = await getConfig(configSchema);
    const consumerConfig = await getConsumerConfig(
      config.FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN,
    );
    const baseUrl = new URL(consumerConfig.apiUrl);
    const stageName = baseUrl.pathname;

    const mapping = matchRemoteRoute(
      event.httpMethod,
      event.pathParameters?.proxy,
      stageName,
    );
    if (!mapping) {
      logger.warn("Route not registered in route config", { event });
      return jsonResponse(status.NOT_FOUND, { message: "Route not found" });
    }

    const body = parseResponseBody(event);
    logger.debug("Request", { remotePath: mapping.remotePath, body });

    const requiresHeaders = isRouteRequiringHeaders(mapping.remotePath);

    const response = await sigv4FetchWithCredentials({
      region: consumerConfig.region,
      baseUrl: consumerConfig.apiUrl,
      method: mapping.method,
      path: mapping.remotePath,
      body,
      externalId: consumerConfig.externalId,
      roleArn: consumerConfig.consumerRoleArn,
      headers: requiresHeaders
        ? {
            "requesting-service": SERVICE_NAME,
            "requesting-service-user-id":
              event.headers["requesting-service-user-id"],
          }
        : undefined,
    });

    const responseBody = await response.json();
    logger.debug("Response", { body: responseBody, status: response.status });
    return jsonResponse(response.status, responseBody);
  },
  {
    serviceName: "udp-service-gateway",
  },
);

export { configSchema, handler };
