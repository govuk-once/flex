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

// cloudfront function expects no export keyword
function handler(event: CloudFrontFunctionsEvent) {
  const authorizationHeader = event.request.headers.authorization;
  if (!authorizationHeader) {
    return generateErrorResponse(
      401,
      "Unauthorized: no authorization header provided",
    );
  }

  const jwt = authorizationHeader.value.split(" ")[1];
  if (!jwt) {
    return generateErrorResponse(401, "Unauthorized: structural check failed");
  }

  return event.request;
}

// Manually expose the handler to the global scope
(globalThis as unknown as { handler: typeof handler }).handler = handler;
