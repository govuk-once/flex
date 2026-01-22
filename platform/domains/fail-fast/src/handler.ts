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

function tryParseJson(jsonString: string): Record<string, unknown> | null {
  try {
    return JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeJwt(token: string) {
  const [header, body, signature, ...rest] = token.split('.');

  if(rest.length > 0) {
    throw new Error('Invalid JWT: too many segments');
  }
  
  if(!header) {
    throw new Error('Invalid JWT: missing header');
  }

  if(!body) {
    throw new Error('Invalid JWT: missing body');
  }

  if(!signature) {
    throw new Error('Invalid JWT: missing signature');
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
    header: JSON.parse(Buffer.from(header, 'base64').toString()) as Record<string, unknown>,
    body: JSON.parse(Buffer.from(body, 'base64').toString()) as Record<string, unknown>,
    signaturePresent: Boolean(signature),
  };
}

export function handler(event: CloudFrontFunctionsEvent) {
  const authorizationHeader = event.request.headers.authorization;
  if (!authorizationHeader) {
    return generateErrorResponse(
      401,
      "Unauthorized: no authorization header provided",
    );
  }

  const [bearerText, jwt, ...rest] = authorizationHeader.value.split(" ");

  if (bearerText !== "Bearer") {
    return generateErrorResponse(401, "Unauthorized: structural check failed");
  }

  if (rest.length > 0) {
    return generateErrorResponse(401, "Unauthorized: structural check failed");
  }

  if (!jwt) {
    return generateErrorResponse(401, "Unauthorized: structural check failed");
  }

  try {
    decodeJwt(jwt);
  } catch (e) {
    return generateErrorResponse(401, "Unauthorized: structural check failed");
  }


  return event.request;
}
