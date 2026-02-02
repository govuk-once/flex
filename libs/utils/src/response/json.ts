import type { APIGatewayProxyResultV2 } from "aws-lambda";

/**
 * Returns a JSON response with the given status code and body.
 *
 * @param statusCode - The status code of the response.
 * @param body - The body of the response.
 * @returns The JSON response.
 */
export function jsonResponse<T>(
  statusCode: number,
  body: T,
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  };
}
