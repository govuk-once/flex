import { it, token } from "@flex/testing";
import {
  linkingId,
  serviceIdentityLink,
  session,
  userId,
} from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/customer/licence", () => {
  const endpoint = "/customer/licence";

  it("returns 200 with the customer driving licence details", async ({
    http,
    sdk,
  }) => {
    const mockLicenceResponse = {
      customerDrivingLicence: {
        licenceType: "Full",
        drivingLicenceNumber: "SMITH999999AB9YZ",
        driverTitle: "Mr",
        driverFirstNames: "JOHN",
        driverLastName: "SMITH",
        licenceStatus: "Valid",
        entitlements: [
          {
            categoryCode: "B",
            categoryType: "Full",
            categoryStatus: "Valid",
          },
        ],
      },
    };

    http
      .domain("udp")
      .get("/identity/dvla", { headers: { "User-Id": userId } })
      .reply(200, serviceIdentityLink);

    http.gateway("dvla").get("/authenticate").reply(200, session);

    http
      .gateway("dvla")
      .get("/customer/licence", {
        headers: { auth: token },
        query: { linkingId },
      })
      .reply(200, mockLicenceResponse);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(mockLicenceResponse);
  });

  it.for([
    { reason: "cannot find the link", upstream: 404, expected: 404 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the UDP get identity link integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http.gateway("dvla").get("/authenticate").reply(200, session);

      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { userId }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the DVLA authenticate integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(200, serviceIdentityLink);

      http.gateway("dvla").get("/authenticate").reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { userId }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );

  it.for([
    { reason: "returns a bad request", upstream: 400, expected: 400 },
    { reason: "cannot find the link", upstream: 404, expected: 404 },
    {
      reason: "cannot find the link (GUK-404-04)",
      upstream: 404,
      expected: 404,
      upstreamBody: {
        error: {
          errors: [{ code: "GUK-404-04", title: "Driving Licence not found" }],
        },
      },
      expectedProviderCode: "GUK-404-04",
      expectedMessage: "Driving Licence not found",
    },
    {
      reason: "cannot find the link (GUK-404-05)",
      upstream: 404,
      expected: 404,
      upstreamBody: {
        error: {
          errors: [{ code: "GUK-404-05", title: "Resource not found" }],
        },
      },
      expectedProviderCode: "GUK-404-05",
      expectedMessage: "Resource not found",
    },
    { reason: "is rate limited", upstream: 429, expected: 429 },
    { reason: "fails unexpectedly", upstream: 500, expected: 502 },
  ])(
    "returns $expected when the DVLA get customer licence integration $reason",
    async (
      {
        upstream,
        expected,
        upstreamBody,
        expectedProviderCode,
        expectedMessage,
      },
      { http, sdk },
    ) => {
      http
        .domain("udp")
        .get("/identity/dvla", { headers: { "User-Id": userId } })
        .reply(200, serviceIdentityLink);

      http.gateway("dvla").get("/authenticate").reply(200, session);

      http
        .gateway("dvla")
        .get("/customer/licence", {
          headers: { auth: token },
          query: { linkingId },
        })
        .reply(upstream, upstreamBody);

      const result = await handler(
        sdk.event.get(endpoint, { userId }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);

      const body = JSON.parse(result.body || "{}") as Record<
        string,
        Record<string, string>
      >;

      const actualCode = body.error?.code;
      const actualMessage = body.error?.message;

      expect(actualCode).toBe(expectedProviderCode);
      expect(actualMessage).toBe(expectedMessage);

      /**
       * If expectedProviderCode exists, result.body should NOT be empty.
       * If expectedProviderCode is undefined, result.body SHOULD be empty.
       */
      const expectedToBeEmpty = expectedProviderCode ? false : true;
      expect(result.body === "").toBe(expectedToBeEmpty);
    },
  );
});
