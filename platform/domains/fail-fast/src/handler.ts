/**
 * CloudFront Function handler for Structural Checks
 *
 * This is an empty function as per the initial implementation.
 * It will be extended with Structural Checks logic in the future.
 *
 * Note: CloudFront Functions run in a restricted JavaScript environment.
 * This TypeScript file will be compiled to plain JavaScript compatible with CloudFront Functions.
 * The handler function must be at the top level and will be transpiled to plain JavaScript.
 */
import { CloudFrontFunctionsEvent } from "aws-lambda";
import { CloudFrontFunctionResponse } from "./types";
import { getLogger } from "@flex/logging";

const FAIL_FAST_SERVICE_NAME = "fail-fast-cloudfront-function";
const logger = getLogger({
  serviceName: FAIL_FAST_SERVICE_NAME,
});

const generateErrorResponse = (
  statusCode: number,
  message: string,
): CloudFrontFunctionResponse => {
  return {
    statusCode: statusCode,
    body: {
      encoding: "text",
      data: message,
    },
    headers: {
      "content-type": { value: "application/json" },
      "x-rejected-by": { value: "cloudfront-function" },
    },
  };
};

/**
 * Attempts to parse a JSON string and returns the resulting object or null if parsing fails.
 *
 * @param jsonString - The JSON string to parse.
 * @returns The parsed object or null if parsing fails.
 */
function tryParseJson(jsonString: string): Record<string, unknown> | null {
  logger.debug("Attempting to parse JSON string", jsonString);

  try {
    return JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    logger.debug("Failed to parse JSON string");
    return null;
  }
}


/**
 * Decodes a JWT token into its constituent parts: header, body, and signature.
 *
 * @param token - The JWT token string.
 * @returns An object containing the decoded header, body, and a flag indicating if the signature is present.
 */
function decodeJwt(token: string) {
  logger.debug("Decoding JWT token", token);

  const [header, body, signature, ...rest] = token.split('.');

  if(rest.length > 0) {
    const message = 'Invalid JWT: too many segments';
    logger.error(message, JSON.stringify(rest));
    throw new Error(message);
  }

  if(!header) {
    const message = 'Invalid JWT: missing header';
    logger.error(message);
    throw new Error(message);
  }

  if(!body) {
    const message = 'Invalid JWT: missing body';
    logger.error(message);
    throw new Error(message);
  }

  if(!signature) {
    const message = 'Invalid JWT: missing signature';
    logger.error(message);
    throw new Error(message);
  }

  const parsedHeader = tryParseJson(Buffer.from(header, 'base64').toString());
  const parsedBody = tryParseJson(Buffer.from(body, 'base64').toString());

  if(!parsedHeader) {
    throw new Error('Invalid JWT: header is not valid JSON');
  }

  if(!parsedBody) {
    throw new Error('Invalid JWT: body is not valid JSON');
  }

  return {
    header: parsedHeader,
    body: parsedBody,
    signaturePresent: Boolean(signature),
  };
}

/**
 * CloudFront Function handler for Structural JWT Checks
 *
 * @param event
 * @returns either the original request if checks pass or an error response if checks fail
 */
export function handler(event: CloudFrontFunctionsEvent) {
  logger.debug("Received event", JSON.stringify(event));

  const authorizationHeader = event.request.headers.authorization;
  if (!authorizationHeader) {
    logger.error("No authorization header provided");
    return generateErrorResponse(
      401,
      "Unauthorized: no authorization header provided",
    );
  }

  const [bearerText, jwt, ...rest] = authorizationHeader.value.split(" ");

  if (bearerText !== "Bearer") {
    logger.error("Authorization header does not start with 'Bearer'");
    return generateErrorResponse(401, "Unauthorized: authentication header invalid");
  }

  if (rest.length > 0) {
    logger.error("Authorization header has too many segments");
    return generateErrorResponse(401, "Unauthorized: authentication header invalid");
  }

  if (!jwt) {
    logger.error("No JWT token provided in authorization header");
    return generateErrorResponse(401, "Unauthorized: authentication header invalid");
  }

  try {
    decodeJwt(jwt);
  } catch (e) {
    logger.error("Failed to decode JWT token", (e as Error).message);
    return generateErrorResponse(401, "Unauthorized: token invalid");
  }

  logger.info("Request passed fail-fast checks");
  return event.request;
}
