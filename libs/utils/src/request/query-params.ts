import type { APIGatewayProxyEventQueryStringParameters } from "aws-lambda";
import type { z } from "zod";

import { QueryParametersParseError } from "../errors";

export function resolveQueryParams<T extends z.ZodType>(
  input: APIGatewayProxyEventQueryStringParameters | null,
  schema?: T,
): Readonly<z.output<T>> | undefined {
  if (!schema) return;

  const result = schema.safeParse(input ?? {});

  if (!result.success) throw new QueryParametersParseError(result.error);

  return result.data;
}
