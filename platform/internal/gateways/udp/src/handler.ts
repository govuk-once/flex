import { getSecret } from "@aws-lambda-powertools/parameters/secrets";
import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { jsonResponse } from "@flex/utils";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import { sigv4FetchWithCredentials } from "@flex/utils";
import { z } from "zod";
import { getConfig } from "@flex/params";

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
  if(!config) {
    throw new Error("Consumer config not found");
  }
  return consumerConfigSchema.parse(JSON.parse(config));
}

// Remote contract: what the remote UDP API exposes
const REMOTE_ROUTES = {
  "GET:/v1/identity/app/:appId": { remotePath: "/v1/identity/app", method: "GET" },
  "POST:/v1/user": { remotePath: "/v1/user", method: "POST" },
  // Add more as you integrate more remote endpoints
} as const;

const SERVICE_NAME = "GOVUK-APP";

type RouteConfig = {
  requiresRequestingServiceHeaders: boolean;
};

const ROUTES_REQUIRING_HEADERS: RegExp[] = [
  /^(?:\/[^/]+)?\/v1\/notifications(\/.*)?$/,
  /^(?:\/[^/]+)?\/v1\/analytics(\/.*)?$/,
  /^(?:\/[^/]+)?\/v1\/preferences(\/.*)?$/,
];

function isRouteRequiringHeaders(path: string): boolean {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return ROUTES_REQUIRING_HEADERS.some((route) => route.test(normalized));
}

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
    const stageSuffix = "/dev"
    const pathSuffix = event.pathParameters?.proxy;
    const remotePath = pathSuffix ? `${stageSuffix}/${pathSuffix}` : `${stageSuffix}`;
    console.log("remotePath", remotePath);
    const body = event.body ? (typeof event.body === "string" ? JSON.parse(event.body as unknown as string) as unknown as unknown : event.body) : undefined;
    logger.info("Request", { remotePath, body });

    const config = await getConfig(configSchema);

    const consumerConfig = await getConsumerConfig(config.FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN);

    const requiresHeaders = isRouteRequiringHeaders(remotePath);
    console.log("requiresHeaders", requiresHeaders);

    const response = await sigv4FetchWithCredentials({
      region: consumerConfig.region,
      baseUrl: consumerConfig.apiUrl,
      method: event.httpMethod,
      path: remotePath,
      body,
      externalId: consumerConfig.externalId,
      roleArn: consumerConfig.consumerRoleArn,
      headers: requiresHeaders ? {
        "requesting-service": SERVICE_NAME,
        "requesting-service-user-id": event.headers["requesting-service-user-id"],
      } : undefined,
    });
    let text = await response.text();
    console.log("test", text);
    let responseBody;
    try {
      responseBody = JSON.parse(text);
    } catch (error) {
      responseBody = { message: text };
    }
    logger.info("Response", { body: responseBody, status: response.status });
    return jsonResponse(response.status, responseBody as unknown as unknown);
  },
  {
    serviceName: "udp-service-gateway",
    logLevel: "DEBUG"
  },
);

export { configSchema, handler };
