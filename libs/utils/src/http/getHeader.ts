import type { APIGatewayProxyEvent } from "aws-lambda";

/**
 * Case-insensitive header lookup (API Gateway may normalize headers differently).
 *
 * @param event - The API Gateway event.
 * @param name - The name of the header to get.
 * @returns The value of the header or undefined if the header is not found.
 */
export function getHeader(
  event: APIGatewayProxyEvent,
  name: string,
): string | undefined {
  // event.headers can be null
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!event.headers) return undefined;

  return Object.entries(event.headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )?.[1];
}
