import { logger } from "@flex/logging";
import { APIGatewayProxyEventPathParameters } from "aws-lambda";
import createHttpError from "http-errors";
import z from "zod";

/**
 * Validates APIGateway path parameters against a Zod schema.
 * Throws a 400 BadRequest if validation fails.
 */
export function validatePathParams<T>(
  schema: z.ZodType<T>,
  data: APIGatewayProxyEventPathParameters | null | undefined,
  contextName = "Path Parameters",
): T {
  const result = schema.safeParse(data ?? {});

  if (!result.success) {
    const errorDetail = JSON.stringify(z.treeifyError(result.error));

    logger().error(`[${contextName}] Validation failed: ${errorDetail}`);

    throw new createHttpError.BadRequest(
      `Invalid ${contextName}: ${errorDetail}`,
    );
  }

  return result.data;
}
