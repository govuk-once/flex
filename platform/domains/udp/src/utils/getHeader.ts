import type { APIGatewayProxyEvent } from "aws-lambda";

/** Case-insensitive header lookup (API Gateway may normalize headers differently). */
export function getHeader(
    event: APIGatewayProxyEvent,
    name: string,
  ): string | undefined {
    const lower = name.toLowerCase();
    const found = Object.entries(event.headers ?? {}).find(
      ([k]) => k.toLowerCase() === lower,
    );
    return found?.[1];
  }
