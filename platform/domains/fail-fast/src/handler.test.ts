import {
  buildCloudFrontEvent,
  buildCloudFrontEventWithAuthorizationHeader,
  buildCloudFrontFunctionErrorResponse,
} from "@flex/testing";
import { describe, expect, it } from "vitest";

import { handler } from "./handler";

describe("CloudFront Function Handler", () => {
  it.each([
    {
      event: buildCloudFrontEvent(),
      expected: buildCloudFrontFunctionErrorResponse(
        "Unauthorized: no authorization header provided",
      ),
    },
    {
      event: buildCloudFrontEventWithAuthorizationHeader(""),
      expected: buildCloudFrontFunctionErrorResponse(
        "Unauthorized: structural check failed",
      ),
    },
    {
      event: buildCloudFrontEventWithAuthorizationHeader("notabearertoken"),
      expected: buildCloudFrontFunctionErrorResponse(
        "Unauthorized: structural check failed",
      ),
    },
    {
      event: buildCloudFrontEventWithAuthorizationHeader("Bearer"),
      expected: buildCloudFrontFunctionErrorResponse(
        "Unauthorized: structural check failed",
      ),
    },
    {
      event: buildCloudFrontEventWithAuthorizationHeader("Bearer "),
      expected: buildCloudFrontFunctionErrorResponse(
        "Unauthorized: structural check failed",
      ),
    },
  ])(
    "returns 401 error response when authorization header is missing",
    ({ event, expected }) => {
      const result = handler(event);

      expect(result).toEqual(expected);
    },
  );

  it("returns the original request when authorization header is present", () => {
    const event =
      buildCloudFrontEventWithAuthorizationHeader("Bearer validtoken");
    const result = handler(event);

    expect(result).toBe(event.request);
  });
});
