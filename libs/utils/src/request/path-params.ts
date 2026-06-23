import type { APIGatewayProxyEventPathParameters } from "aws-lambda";

export function resolvePathParams(
  params: APIGatewayProxyEventPathParameters | null,
) {
  if (!params || Object.keys(params).length === 0) return;

  return Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}
