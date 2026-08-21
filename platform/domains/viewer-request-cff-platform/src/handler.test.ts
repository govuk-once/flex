import { CffTelemetryEvent, emitCffTelemetry } from "@flex/telemetry/cff";
import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./handler";

vi.mock("@flex/telemetry/cff");

describe("CloudFront Function: Flex Platform", () => {
  const jwtHeader = "eyJoZWxsbyI6ICJ3b3JsZCJ9";
  const jwtBody = "eyJoZWxsbyI6ICJUb20ifQ==";
  const jwtSignature = "c2lnbmF0dXJl";
  const jwt = `${jwtHeader}.${jwtBody}.${jwtSignature}`;

  const uri = "/example";
  const token = `Bearer ${jwt}`;
  const correlationId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Error handling", () => {
    it.for<{
      reason: string;
      headers: Record<string, string>;
      telemetryEvent: CffTelemetryEvent;
    }>([
      {
        reason: "the authorization header is missing",
        headers: {},
        telemetryEvent: CffTelemetryEvent.cff_token_missing,
      },
      {
        reason: "the authorization header is empty",
        headers: { authorization: "" },
        telemetryEvent: CffTelemetryEvent.cff_token_missing,
      },
      {
        reason: 'the Bearer token is missing the "Bearer" prefix',
        headers: { authorization: "notabearertoken" },
        telemetryEvent: CffTelemetryEvent.cff_token_invalid,
      },
      {
        reason: 'the authorization header provides "Bearer" without a token',
        headers: { authorization: "Bearer" },
        telemetryEvent: CffTelemetryEvent.cff_token_missing,
      },
      {
        reason: "the Bearer token provides too many segments",
        headers: { authorization: "Bearer too many segments" },
        telemetryEvent: CffTelemetryEvent.cff_token_invalid,
      },
      {
        reason: "the Bearer token header is invalid",
        headers: { authorization: `Bearer header.${jwtBody}.${jwtSignature}` },
        telemetryEvent: CffTelemetryEvent.cff_token_invalid,
      },
      {
        reason: "the Bearer token body is invalid",
        headers: { authorization: `Bearer ${jwtHeader}.body.${jwtSignature}` },
        telemetryEvent: CffTelemetryEvent.cff_token_invalid,
      },
      {
        reason: "the Bearer token signature is missing",
        headers: { authorization: `Bearer ${jwtHeader}.${jwtBody}` },
        telemetryEvent: CffTelemetryEvent.cff_token_invalid,
      },
      {
        reason: "the Bearer token JWT body and signature are both mising",
        headers: { authorization: `Bearer ${jwtHeader}` },
        telemetryEvent: CffTelemetryEvent.cff_token_invalid,
      },
      {
        reason: "the Bearer token body is valid JSON but is not an object",
        headers: {
          authorization: `Bearer ${jwtHeader}.MTIzNDU=.${jwtSignature}`,
        },
        telemetryEvent: CffTelemetryEvent.cff_token_invalid,
      },
    ])(
      "returns Unauthorized and emits telemetry event when $reason",
      ({ headers, telemetryEvent }, { platform }) => {
        const result = handler(platform.cloudFrontEvent.get(uri, { headers }));

        expect(result).toStrictEqual(
          platform.cloudFrontResult(401, {
            body: { message: "Unauthorized", type: "auth_error" },
            headers: {
              "content-type": { value: "application/json" },
              "x-rejected-by": { value: "cloudfront-function" },
            },
          }),
        );
        expect(emitCffTelemetry).toHaveBeenCalledExactlyOnceWith(
          telemetryEvent,
          {
            correlationId: expect.any(String) as string,
            reason: expect.any(String) as string,
          },
        );
      },
    );
  });

  it("uses the provided correlation ID when it is a valid UUID", ({
    platform,
  }) => {
    const event = platform.cloudFrontEvent.get(uri, {
      headers: { authorization: token, "x-correlation-id": correlationId },
    });

    handler(event);

    expect(event.request.headers["x-correlation-id"]?.value).toBe(
      correlationId,
    );
    expect(emitCffTelemetry).toHaveBeenCalledExactlyOnceWith(
      CffTelemetryEvent.cff_token_validated,
      { correlationId },
    );
  });

  it("derives a correlation ID when the provided ID is not a valid UUID", ({
    platform,
  }) => {
    const mockInvalidUuid = "invalid-uuid";

    const event = platform.cloudFrontEvent.get(uri, {
      headers: { authorization: token, "x-correlation-id": mockInvalidUuid },
    });

    handler(event);

    const eventCorrelationId = event.request.headers["x-correlation-id"]?.value;

    expect(eventCorrelationId).not.toBe(mockInvalidUuid);
    expect(emitCffTelemetry).toHaveBeenCalledExactlyOnceWith(
      CffTelemetryEvent.cff_token_validated,
      { correlationId: eventCorrelationId },
    );
  });

  it("returns the original request when authorization header is present", ({
    platform,
  }) => {
    const event = platform.cloudFrontEvent.get(uri, {
      headers: { authorization: token },
    });

    const result = handler(event);

    expect(result).toBe(event.request);
    expect(emitCffTelemetry).toHaveBeenCalledExactlyOnceWith(
      CffTelemetryEvent.cff_token_validated,
      { correlationId: expect.any(String) as string },
    );
  });
});
