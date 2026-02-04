import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";

const configSchema = z.object({
  AWS_REGION: z.string().min(1),
});

/**
 * UDP connector (service gateway) – internal-only, invoked via the private API gateway.
 *
 * Follows the plan: receives validated request body, (future: calls remote UDP API with
 * credentials/ACL), returns mapped response. No direct invocation from domain lambdas.
 */
const handler = createLambdaHandler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
>(
  async (): Promise<APIGatewayProxyResultV2> => {
    const logger = getLogger();
    try {
      return Promise.resolve({
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hello world!",
          gateway: "udp",
        }),
      });
    } catch (error) {
      logger.error("Failed to process request", { error });
      return Promise.resolve({
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Failed to process request",
        }),
      });
    }
  },
  {
    serviceName: "udp-connector",
  },
);

export { configSchema, handler };
