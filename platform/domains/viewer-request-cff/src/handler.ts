/**
 * CloudFront Function handler for viewer request validation
 *
 * Note: CloudFront Functions run in a restricted JavaScript environment.
 * This TypeScript file will be compiled to plain JavaScript compatible with CloudFront Functions.
 * The handler function must be at the top level and will be transpiled to plain JavaScript.
 */

import { CloudFrontFunctionsEvent } from "aws-lambda";

import { unathorizedResponse } from "./responses/unathorized";
import { validateAuthorization } from "./validators/authoriztion";
import { validateJwt } from "./validators/jwt";

/**
 * CloudFront Function handler for viewer request validation
 *
 * @param event
 * @returns either the original request if checks pass or an error response if checks fail
 */
export function handler(event: CloudFrontFunctionsEvent) {
  const request = event.request;
  const headers = request.headers;

  try {
    const maybeJwt = validateAuthorization(headers.authorization?.value);
    validateJwt(maybeJwt);
  } catch (err: unknown) {
    // Cloudfront functions only reliably support console.log(...) for logging.
    if (err instanceof Error) console.log(err.message);
    return unathorizedResponse;
  }

  return event.request;
}
