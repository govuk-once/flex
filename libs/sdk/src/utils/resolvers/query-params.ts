import type { APIGatewayProxyEventQueryStringParameters } from "aws-lambda";
import type { ZodType } from "zod";
import { ZodError } from "zod";

import { QueryParametersParseError } from "../errors";

export function resolveQueryParams(
  queryStringParameters: APIGatewayProxyEventQueryStringParameters | null,
  schema?: ZodType,
) {
  if (!schema) return;

  try {
    return schema.parse(queryStringParameters ?? {}) as Readonly<
      Record<string, unknown>
    >;
  } catch (error) {
    if (error instanceof ZodError) throw new QueryParametersParseError(error);
    throw error;
  }
}
