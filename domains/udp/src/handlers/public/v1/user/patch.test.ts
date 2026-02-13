import { it } from "@flex/testing";
import nock from "nock";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./patch";

const PRIVATE_GATEWAY_ORIGIN = "https://execute-api.eu-west-2.amazonaws.com";
const PRIVATE_GATEWAY_BASE_URL = `${PRIVATE_GATEWAY_ORIGIN}/gateways/udp`;
const NOTIFICATIONS_PATH = "/gateways/udp/gateways/udp/v1/notifications";

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: PRIVATE_GATEWAY_BASE_URL,
    }),
  ),
}));
vi.mock("@flex/middlewares");
vi.mock("aws-sigv4-fetch", () => ({
  createSignedFetcher: vi.fn(() => fetch),
}));

describe("PATCH /user handler", () => {
  const testPairwiseId = "test-pairwise-id";

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
  });

  describe("successful preference updates", () => {
    it("returns user preferences updated successfully", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(NOTIFICATIONS_PATH)
        .matchHeader("requesting-service", "app")
        .matchHeader("requesting-service-user-id", testPairwiseId)
        .reply(200, {});

      const request = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({
            notificationsConsented: true,
            analyticsConsented: true,
          }),
        }),
        context.withPairwiseId().create(),
      );

      expect(request).toEqual(
        response.ok(
          {},
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });

    it("allows updating one field at a time", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      nock(PRIVATE_GATEWAY_ORIGIN).post(NOTIFICATIONS_PATH).reply(200, {});

      const request = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({ notificationsConsented: true }),
        }),
        context.withPairwiseId().create(),
      );

      expect(request).toEqual(
        response.ok(
          {},
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });

    it("allows updating analyticsConsented only", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      nock(PRIVATE_GATEWAY_ORIGIN).post(NOTIFICATIONS_PATH).reply(200, {});

      const request = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({ analyticsConsented: false }),
        }),
        context.withPairwiseId().create(),
      );

      expect(request).toEqual(
        response.ok(
          {},
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });
  });

  describe("invalid payloads", () => {
    it.for([
      {
        body: { notificationsConsented: "yes", analyticsConsented: true },
        desc: "string instead of boolean",
      },
      {
        body: { notificationsConsented: 1, analyticsConsented: true },
        desc: "number instead of boolean",
      },
      {
        body: { notificationsConsented: null, analyticsConsented: true },
        desc: "null instead of boolean",
      },
      {
        body: {},
        desc: "missing notificationsConsented and analyticsConsented",
      },
    ])(
      "rejects invalid payload: $desc",
      async ({ body }, { eventWithAuthorizer, context }) => {
        const result = await handler(
          eventWithAuthorizer.authenticated({ body: JSON.stringify(body) }),
          context.withPairwiseId().create(),
        );

        expect(result).toEqual(expect.objectContaining({ statusCode: 400 }));
      },
    );
  });

  describe("request parsing", () => {
    it("parses JSON body even with non-standard Content-Type casing", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      nock(PRIVATE_GATEWAY_ORIGIN).post(NOTIFICATIONS_PATH).reply(200, {});

      const result = await handler(
        eventWithAuthorizer.authenticated({
          headers: { "CoNtEnT-TyPe": "application/json" },
          body: JSON.stringify({
            notificationsConsented: true,
            analyticsConsented: true,
          }),
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(
        response.ok(
          {},
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });
  });

  describe("API integration", () => {
    it("uses pairwiseId from context in request headers", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const customPairwiseId = "custom-user-456";
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(NOTIFICATIONS_PATH)
        .matchHeader("requesting-service-user-id", customPairwiseId)
        .reply(200, {});

      const result = await handler(
        eventWithAuthorizer.authenticated(
          {
            body: JSON.stringify({
              notificationsConsented: true,
              analyticsConsented: true,
            }),
          },
          customPairwiseId,
        ),
        context.withPairwiseId(customPairwiseId).create(),
      );

      expect(result).toEqual(
        response.ok({}, { headers: { "Content-Type": "application/json" } }),
      );
    });

    it("returns 200 with preferences when API returns 200", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      nock(PRIVATE_GATEWAY_ORIGIN).post(NOTIFICATIONS_PATH).reply(200, {});

      const result = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({
            notificationsConsented: false,
            analyticsConsented: true,
          }),
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(
        response.ok({}, { headers: { "Content-Type": "application/json" } }),
      );
    });

    it("handles API returning 500 with JSON body", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(NOTIFICATIONS_PATH)
        .reply(500, { message: "Internal Server Error" });

      const result = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({
            notificationsConsented: true,
            analyticsConsented: true,
          }),
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(
        response.internalServerError(
          { message: "Internal Server Error" },
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    });

    it("returns 500 when API returns non-JSON response", async ({
      eventWithAuthorizer,
      context,
    }) => {
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(NOTIFICATIONS_PATH)
        .reply(500, "Internal Server Error");

      const result = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({
            notificationsConsented: true,
            analyticsConsented: true,
          }),
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
        }),
      );
    });

    it("returns 500 when network request fails", async ({
      eventWithAuthorizer,
      context,
    }) => {
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(NOTIFICATIONS_PATH)
        .replyWithError("ECONNREFUSED");

      const result = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({
            notificationsConsented: true,
            analyticsConsented: true,
          }),
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
        }),
      );
    });
  });
});
