import { it } from "@flex/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./patch";

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: "https://execute-api.eu-west-2.amazonaws.com",
    }),
  ),
}));
vi.mock("@flex/middlewares");
vi.mock("../../services/updateNotificationPreferences", () => ({
  updateNotificationPreferences: vi.fn(),
}));

import { updateNotificationPreferences } from "../../services/updateNotificationPreferences";

describe("PATCH /user handler", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateNotificationPreferences).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
  });

  describe("successful preference updates", () => {
    it("returns user preferences updated successfully", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const result = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({
            notificationsConsented: "consented",
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
      expect(updateNotificationPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          pairwiseId: "test-pairwise-id",
          consentStatus: "consented",
          awsRegion: "eu-west-2",
        }),
      );
    });

    it("passes pairwiseId and consent status to updateNotificationPreferences", async ({
      eventWithAuthorizer,
      context,
    }) => {
      const customPairwiseId = "custom-user-456";
      await handler(
        eventWithAuthorizer.authenticated(
          {
            body: JSON.stringify({
              notificationsConsented: "not_consented",
            }),
          },
          customPairwiseId,
        ),
        context.withPairwiseId(customPairwiseId).create(),
      );

      expect(updateNotificationPreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          pairwiseId: customPairwiseId,
          consentStatus: "not_consented",
        }),
      );
    });

    it("returns 200 when updateNotificationPreferences succeeds", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const result = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({ notificationsConsented: "consented" }),
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(
        response.ok({}, { headers: { "Content-Type": "application/json" } }),
      );
    });
  });

  describe("invalid payloads", () => {
    it.for([
      {
        body: { notificationsConsented: "yes" },
        desc: "string instead of enum value",
      },
      {
        body: { notificationsConsented: 1 },
        desc: "number instead of string",
      },
      {
        body: { notificationsConsented: null },
        desc: "null instead of string",
      },
      {
        body: {},
        desc: "missing notificationsConsented",
      },
    ])(
      "rejects invalid payload: $desc",
      async ({ body }, { eventWithAuthorizer, context }) => {
        const result = await handler(
          eventWithAuthorizer.authenticated({ body: JSON.stringify(body) }),
          context.withPairwiseId().create(),
        );

        expect(result).toEqual(expect.objectContaining({ statusCode: 400 }));
        expect(updateNotificationPreferences).not.toHaveBeenCalled();
      },
    );
  });

  describe("request parsing", () => {
    it("parses JSON body even with non-standard Content-Type casing", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const result = await handler(
        eventWithAuthorizer.authenticated({
          headers: { "CoNtEnT-TyPe": "application/json" },
          body: JSON.stringify({
            notificationsConsented: "consented",
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
    it("returns 500 when updateNotificationPreferences returns 500 with JSON body", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      vi.mocked(updateNotificationPreferences).mockResolvedValue(
        new Response(JSON.stringify({ message: "Internal Server Error" }), {
          status: 500,
        }),
      );

      const result = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({
            notificationsConsented: "consented",
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

    it("returns 500 when updateNotificationPreferences returns non-JSON response", async ({
      eventWithAuthorizer,
      context,
    }) => {
      vi.mocked(updateNotificationPreferences).mockResolvedValue(
        new Response("Internal Server Error", { status: 500 }),
      );

      const result = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({
            notificationsConsented: "consented",
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

    it("returns 500 when updateNotificationPreferences throws", async ({
      eventWithAuthorizer,
      context,
    }) => {
      vi.mocked(updateNotificationPreferences).mockRejectedValue(
        new Error("Network error"),
      );

      const result = await handler(
        eventWithAuthorizer.authenticated({
          body: JSON.stringify({
            notificationsConsented: "consented",
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
