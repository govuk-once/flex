import {
  buildCloudFrontEvent,
  buildCloudFrontEventWithAuthorizationHeader,
  buildCloudFrontFunctionErrorResponse,
} from "@flex/testing";
import { describe, expect, it } from "vitest";

import { handler } from "./handler";

const validHeader = "eyJoZWxsbyI6ICJ3b3JsZCJ9";
const validBody = "eyJoZWxsbyI6ICJUb20ifQ==";
const validSignature = "c2lnbmF0dXJl";
const validToken = `${validHeader}.${validBody}.${validSignature}`;

describe("CloudFront Function Handler", () => {
  it.each([
    {
      description: "fails with missing authorization header",
      event: buildCloudFrontEvent(),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
    },
    {
      description: "fails with empty authorization header",
      event: buildCloudFrontEventWithAuthorizationHeader(""),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
    },
    {
      description: "fails with malformed authorization header",
      event: buildCloudFrontEventWithAuthorizationHeader("notabearertoken"),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
    },
    {
      description: "fails with only 'Bearer' in authorization header",
      event: buildCloudFrontEventWithAuthorizationHeader("Bearer"),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
    },
    {
      description: "fails with too many segments in auth header",
      event: buildCloudFrontEventWithAuthorizationHeader(
        "Bearer invalidtoken multipart",
      ),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
    },
    {
      description: "fails with invalid JWT header",
      event: buildCloudFrontEventWithAuthorizationHeader(
        `Bearer invalidHealder.${validBody}.${validSignature}`,
      ),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
    },
    {
      description: "fails with invalid JWT body",
      event: buildCloudFrontEventWithAuthorizationHeader(
        `Bearer ${validHeader}.invalidBody.${validSignature}`,
      ),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
    },
    {
      description:
        "fails with authorization header with missing signature part",
      event: buildCloudFrontEventWithAuthorizationHeader(
        `Bearer ${validHeader}.${validBody}`,
      ),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
    },
    {
      description: "fails with authorization header with missing body",
      event: buildCloudFrontEventWithAuthorizationHeader(
        `Bearer ${validHeader}`,
      ),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
    },
    {
      description:
        "fails when payload is valid JSON but not an object (e.g. a number)",
      event: buildCloudFrontEventWithAuthorizationHeader(
        `Bearer ${validHeader}.MTIzNDU=.${validSignature}`,
      ),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
    },
  ])("$description", ({ event, expected }) => {
    const result = handler(event);

    expect(result).toEqual(expected);
  });

  it("returns the original request when authorization header is present", () => {
    const event = buildCloudFrontEventWithAuthorizationHeader(
      `Bearer ${validToken}`,
    );
    const result = handler(event);

    expect(result).toBe(event.request);
  });
});
