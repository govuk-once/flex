import { createLambdaHandler } from "@flex/handlers";
import { getLogger } from "@flex/logging";
import { jsonResponse } from "@flex/utils";
import type { APIGatewayProxyEvent } from "aws-lambda";
import status from "http-status";
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
const handler = createLambdaHandler<APIGatewayProxyEvent>(
  async (event) => {
    const logger = getLogger();
    try {
      return Promise.resolve(jsonResponse(status.OK, event.body));
    } catch (error) {
      logger.error("Failed to process request", { error });
      return Promise.resolve(
        jsonResponse(status.INTERNAL_SERVER_ERROR, {
          message: "Failed to process request",
        }),
      );
    }
  },
  {
    serviceName: "udp-connector",
  },
);

export { configSchema, handler };
