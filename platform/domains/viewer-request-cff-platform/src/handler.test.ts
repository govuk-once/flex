import { EdgeTelemetryEvent, emitEdgeTelemetry } from "@flex/telemetry/edge";
import {
  buildCloudFrontEvent,
  buildCloudFrontEventWithAuthorizationHeader,
  buildCloudFrontFunctionErrorResponse,
} from "@flex/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handler } from "./handler";

vi.mock("@flex/telemetry/edge");

const validHeader = "eyJoZWxsbyI6ICJ3b3JsZCJ9";
const validBody = "eyJoZWxsbyI6ICJUb20ifQ==";
const validSignature = "c2lnbmF0dXJl";
const validToken = `${validHeader}.${validBody}.${validSignature}`;

describe("CloudFront Function Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      description: "fails with missing authorization header",
      event: buildCloudFrontEvent(),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
      expectedTelemetryEvent: EdgeTelemetryEvent.edge_token_missing,
    },
    {
      description: "fails with empty authorization header",
      event: buildCloudFrontEventWithAuthorizationHeader(""),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
      expectedTelemetryEvent: EdgeTelemetryEvent.edge_token_missing,
    },
    {
      description: "fails with malformed authorization header",
      event: buildCloudFrontEventWithAuthorizationHeader("notabearertoken"),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
      expectedTelemetryEvent: EdgeTelemetryEvent.edge_token_invalid,
    },
    {
      description: "fails with only 'Bearer' in authorization header",
      event: buildCloudFrontEventWithAuthorizationHeader("Bearer"),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
      expectedTelemetryEvent: EdgeTelemetryEvent.edge_token_missing,
    },
    {
      description: "fails with too many segments in auth header",
      event: buildCloudFrontEventWithAuthorizationHeader(
        "Bearer invalidtoken multipart",
      ),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
      expectedTelemetryEvent: EdgeTelemetryEvent.edge_token_invalid,
    },
    {
      description: "fails with invalid JWT header",
      event: buildCloudFrontEventWithAuthorizationHeader(
        `Bearer invalidHealder.${validBody}.${validSignature}`,
      ),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
      expectedTelemetryEvent: EdgeTelemetryEvent.edge_token_invalid,
    },
    {
      description: "fails with invalid JWT body",
      event: buildCloudFrontEventWithAuthorizationHeader(
        `Bearer ${validHeader}.invalidBody.${validSignature}`,
      ),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
      expectedTelemetryEvent: EdgeTelemetryEvent.edge_token_invalid,
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
      expectedTelemetryEvent: EdgeTelemetryEvent.edge_token_invalid,
    },
    {
      description: "fails with authorization header with missing body",
      event: buildCloudFrontEventWithAuthorizationHeader(
        `Bearer ${validHeader}`,
      ),
      expected: buildCloudFrontFunctionErrorResponse(
        '{"message":"Unauthorized"}',
      ),
      expectedTelemetryEvent: EdgeTelemetryEvent.edge_token_invalid,
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
      expectedTelemetryEvent: EdgeTelemetryEvent.edge_token_invalid,
    },
  ])("$description", ({ event, expected, expectedTelemetryEvent }) => {
    const result = handler(event);

    expect(result).toEqual(expected);
    expect(emitEdgeTelemetry).toHaveBeenCalledExactlyOnceWith(
      expectedTelemetryEvent,
      {
        correlationId: expect.any(String) as string,
        reason: expect.any(String) as string,
      },
    );
  });

  it("returns the original request when authorization header is present", () => {
    const event = buildCloudFrontEventWithAuthorizationHeader(
      `Bearer ${validToken}`,
    );
    const result = handler(event);

    expect(result).toBe(event.request);
    expect(emitEdgeTelemetry).toHaveBeenCalledExactlyOnceWith(
      EdgeTelemetryEvent.edge_token_validated,
      { correlationId: expect.any(String) as string },
    );
  });
});
