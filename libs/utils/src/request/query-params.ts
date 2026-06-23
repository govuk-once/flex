import type { APIGatewayProxyEventQueryStringParameters } from "aws-lambda";
import type { ZodType } from "zod";
import { ZodError } from "zod";

import { QueryParametersParseError } from "../errors";

export function resolveQueryParams(
  input: APIGatewayProxyEventQueryStringParameters | null,
  schema?: ZodType,
): Readonly<Record<string, unknown>> | undefined {
  if (!schema) return;

  try {
    return schema.parse(input ?? {}) as Readonly<Record<string, unknown>>;
  } catch (error) {
    if (error instanceof ZodError) throw new QueryParametersParseError(error);
    throw error;
  }
}
