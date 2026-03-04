import type { APIGatewayProxyResultV2 } from "aws-lambda";

/**
 * Returns a JSON response with the given status code and body.
 *
 * @param statusCode - The status code of the response.
 * @param body - The body of the response.
 * @returns The JSON response.
 */
export function jsonResponse(
  statusCode: number,
  body?: unknown,
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  };
}
