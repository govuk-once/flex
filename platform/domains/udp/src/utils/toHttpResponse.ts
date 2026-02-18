import { jsonResponse } from "@flex/utils";
import type { APIGatewayProxyResultV2 } from "aws-lambda";

import type { ApiResult } from "../client";

/**
 * Translates remote API result to internal response.
 * Maps ApiResult to HTTP response; identity translation when shapes match.
 */
export function toHttpResponse<T>(
  result: ApiResult<T>,
): APIGatewayProxyResultV2 {
  if (result.ok) {
    return jsonResponse(result.status, result.data);
  }
  return jsonResponse(result.status, {
    message: result.error.message,
    ...(result.error.code && { code: result.error.code }),
  });
}
