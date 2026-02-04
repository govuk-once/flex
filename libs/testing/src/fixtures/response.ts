export interface StructuredResponse {
  statusCode: number;
  headers?: Record<string, boolean | number | string>;
  body?: string;
  cookies?: string[];
  isBase64Encoded?: boolean;
}

export type ResponseOptions = Pick<
  StructuredResponse,
  "headers" | "cookies" | "isBase64Encoded"
>;

function buildResponse(
  statusCode: number,
  body?: unknown,
  options?: ResponseOptions,
): StructuredResponse;
function buildResponse<T>(
  statusCode: number,
  body?: T,
  options: ResponseOptions = {},
): StructuredResponse {
  return {
    statusCode,
    body:
      body != null
        ? typeof body === "string"
          ? body
          : JSON.stringify(body)
        : undefined,
    ...options,
  };
}

export function createResponse() {
  return {
    create: (statusCode: number, body: unknown, options?: ResponseOptions) =>
      buildResponse(statusCode, body, options),

    ok: (body: unknown, options?: ResponseOptions) =>
      buildResponse(200, body, options),
    created: (body: unknown, options?: ResponseOptions) =>
      buildResponse(201, body, options),
    accepted: (body: unknown, options?: ResponseOptions) =>
      buildResponse(202, body, options),
    noContent: (options?: ResponseOptions) => buildResponse(204, null, options),

    badRequest: (body: unknown, options?: ResponseOptions) =>
      buildResponse(400, body, options),
    unauthorized: (body: unknown, options?: ResponseOptions) =>
      buildResponse(401, body, options),
    forbidden: (body: unknown, options?: ResponseOptions) =>
      buildResponse(403, body, options),
    notFound: (body: unknown, options?: ResponseOptions) =>
      buildResponse(404, body, options),
    conflict: (body: unknown, options?: ResponseOptions) =>
      buildResponse(409, body, options),
    tooManyRequests: (body: unknown, options?: ResponseOptions) =>
      buildResponse(429, body, options),

    internalServerError: (body: unknown, options?: ResponseOptions) =>
      buildResponse(500, body, options),
    badGateway: (body: unknown, options?: ResponseOptions) =>
      buildResponse(502, body, options),
    serviceUnavailable: (body: unknown, options?: ResponseOptions) =>
      buildResponse(503, body, options),
    gatewayTimeout: (body: unknown, options?: ResponseOptions) =>
      buildResponse(504, body, options),
  } as const;
}

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status
export const response = {
  ok: buildResponse(200, { message: "Success" }),
  created: buildResponse(201, { id: "test-uuid" }),
  accepted: buildResponse(202, { message: "Processing" }),
  noContent: buildResponse(204),

  badRequest: buildResponse(400, { message: "Invalid request body" }),
  unauthorized: buildResponse(401, { message: "Unauthorized" }),
  forbidden: buildResponse(403, { message: "Forbidden" }),
  notFound: buildResponse(404, { message: "Not found" }),
  conflict: buildResponse(409, { message: "Conflict" }),
  tooManyRequests: buildResponse(429, { message: "Rate limited" }),

  internalServerError: buildResponse(500, { message: "Internal server error" }),
  badGateway: buildResponse(502, { message: "Bad gateway" }),
  serviceUnavailable: buildResponse(503, { message: "Service unavailable" }),
  gatewayTimeout: buildResponse(504, { message: "Gateway timeout" }),
} as const;
