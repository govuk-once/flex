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
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { Sha256 } from '@aws-crypto/sha256-js';

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
    const body = event.body ? (typeof event.body === "string" ? JSON.parse(event.body as unknown as string) as unknown as unknown : event.body) : undefined;

    const config = await getConfig(configSchema);
    const consumerConfig = await getConsumerConfig(config.FLEX_UDP_CONSUMER_CONFIG_SECRET_ARN);
    const response = await sigv4FetchWithCredentials({
      region: consumerConfig.region,
      baseUrl: consumerConfig.apiUrl,
      method: event.httpMethod,
      path: remotePath,
      body,
      externalId: consumerConfig.externalId,
      roleArn: consumerConfig.consumerRoleArn,
    });
    const text = await response.text();
    let responseBody: unknown = {};
    if (text.trim()) {
      try {
        responseBody = JSON.parse(text);
      } catch {
        // Non-JSON response (e.g. HTML error page)
        responseBody = { message: text };
      }
    }
    logger.info("Response", { text, status: response.status });
    return jsonResponse(response.status, responseBody);
  },
  {
    serviceName: "udp-service-gateway",
    logLevel: "DEBUG",
  },
);

export { configSchema, handler };
