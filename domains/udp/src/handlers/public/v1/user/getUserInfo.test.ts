import { ContextWithPairwiseId } from "@flex/middlewares";
import { it } from "@flex/testing";
import nock from "nock";
import { afterAll, beforeAll, beforeEach, describe, expect, vi } from "vitest";

import { generateDerivedId } from "../../../../service/derived-id";
import { handler, NotificationSecretContext } from "./getUserInfo";

const PRIVATE_GATEWAY_ORIGIN = "https://execute-api.eu-west-2.amazonaws.com";
const PRIVATE_GATEWAY_BASE_URL = `${PRIVATE_GATEWAY_ORIGIN}/gateways/udp`;
const NOTIFICATIONS_PATH = "/gateways/udp/gateways/udp/v1/notifications";
const USER_PATH = "/gateways/udp/domains/udp/v1/user";

vi.mock("../../../../service/derived-id", () => ({
  generateDerivedId: vi.fn(),
}));
vi.mock("@flex/middlewares");
vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: PRIVATE_GATEWAY_BASE_URL,
    }),
  ),
}));
vi.mock("aws-sigv4-fetch", () => ({
  createSignedFetcher: vi.fn(() => fetch),
}));

type UserGetContext = ContextWithPairwiseId & NotificationSecretContext;

describe("GetUserInfo handler", () => {
  const mockNotificationSecret = {
    notificationSecretKey: "mocked-notification-secret", // pragma: allowlist secret
  };
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

  describe("successful user creation", () => {
    it("returns 200 with notification ID and preferences when GET returns 404 and POST succeeds", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(NOTIFICATIONS_PATH)
        .matchHeader("requesting-service", "GOVUK-APP")
        .matchHeader("requesting-service-user-id", testPairwiseId)
        .reply(404);

      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(USER_PATH, {
          notificationId: mockNotificationId,
          appId: testPairwiseId,
        })
        .reply(201, {});

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.ok(
          {
            notificationId: mockNotificationId,
            preferences: {
              notifications: {
                consentStatus: "unknown",
                updatedAt: new Date().toISOString(),
              },
              analytics: {
                consentStatus: "unknown",
                updatedAt: new Date().toISOString(),
              },
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });

    it("returns 200 when GET returns 200 and POST succeeds", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(NOTIFICATIONS_PATH)
        .reply(200, { existing: "data" });

      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(USER_PATH, {
          notificationId: mockNotificationId,
          appId: testPairwiseId,
        })
        .reply(201, {});

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.ok(
          {
            notificationId: mockNotificationId,
            preferences: {
              notifications: {
                consentStatus: "unknown",
                updatedAt: new Date().toISOString(),
              },
              analytics: {
                consentStatus: "unknown",
                updatedAt: new Date().toISOString(),
              },
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });

    it("calls generateDerivedId with correct parameters", async ({
      eventWithAuthorizer,
      context,
    }) => {
      const mockNotificationId = "mocked-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      nock(PRIVATE_GATEWAY_ORIGIN).get(NOTIFICATIONS_PATH).reply(404);
      nock(PRIVATE_GATEWAY_ORIGIN).post(USER_PATH).reply(201, {});

      await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(generateDerivedId).toHaveBeenCalledWith({
        pairwiseId: testPairwiseId,
        secretKey: mockNotificationSecret.notificationSecretKey,
      });
    });

    it("uses the pairwiseId from context in requests and response", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      const customPairwiseId = "custom-user-id-123";
      const mockNotificationId = "generated-notification-id";
      vi.mocked(generateDerivedId).mockReturnValue(mockNotificationId);

      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(NOTIFICATIONS_PATH)
        .matchHeader("requesting-service-user-id", customPairwiseId)
        .reply(404);

      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(USER_PATH, {
          notificationId: mockNotificationId,
          appId: customPairwiseId,
        })
        .reply(201, {});

      const result = await handler(
        eventWithAuthorizer.authenticated({}, customPairwiseId),
        context
          .withPairwiseId(customPairwiseId)
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.ok(
          {
            notificationId: mockNotificationId,
            preferences: {
              notifications: {
                consentStatus: "unknown",
                updatedAt: new Date().toISOString(),
              },
              analytics: {
                consentStatus: "unknown",
                updatedAt: new Date().toISOString(),
              },
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
      expect(generateDerivedId).toHaveBeenCalledWith({
        pairwiseId: customPairwiseId,
        secretKey: mockNotificationSecret.notificationSecretKey,
      });
    });
  });

  describe("GET notifications API errors", () => {
    it("returns 502 BAD_GATEWAY when GET notifications returns 500", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      vi.mocked(generateDerivedId).mockReturnValue("mocked-notification-id");

      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(NOTIFICATIONS_PATH)
        .reply(500, { error: "Internal Server Error" });

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.badGateway(
          {
            message: "Private API gateway returned error",
            status: 500,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });

    it("returns 502 BAD_GATEWAY when GET notifications returns 403", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      vi.mocked(generateDerivedId).mockReturnValue("mocked-notification-id");

      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(NOTIFICATIONS_PATH)
        .reply(403, { error: "Forbidden" });

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.badGateway(
          {
            message: "Private API gateway returned error",
            status: 403,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });
  });

  describe("POST create user API errors", () => {
    it("returns 502 BAD_GATEWAY when POST create user returns 500", async ({
      response,
      eventWithAuthorizer,
      context,
    }) => {
      vi.mocked(generateDerivedId).mockReturnValue("mocked-notification-id");

      nock(PRIVATE_GATEWAY_ORIGIN).get(NOTIFICATIONS_PATH).reply(404);
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(USER_PATH)
        .reply(500, { error: "Internal Server Error" });

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.badGateway(
          {
            message: "Private API gateway returned error",
            status: 500,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });
  });

  describe("service integration", () => {
    it("calls generateDerivedId exactly once per request", async ({
      eventWithAuthorizer,
      context,
    }) => {
      vi.mocked(generateDerivedId).mockReturnValue("mocked-notification-id");
      nock(PRIVATE_GATEWAY_ORIGIN).get(NOTIFICATIONS_PATH).reply(404);
      nock(PRIVATE_GATEWAY_ORIGIN).post(USER_PATH).reply(201, {});

      await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(generateDerivedId).toHaveBeenCalledTimes(1);
    });

    it("returns 500 when generateDerivedId throws", async ({
      eventWithAuthorizer,
      context,
      response,
    }) => {
      const error = new Error("generateDerivedId failed");
      vi.mocked(generateDerivedId).mockImplementation(() => {
        throw error;
      });

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.internalServerError(
          { message: "Failed to get user info" },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });

    it("returns 500 when network request fails", async ({
      eventWithAuthorizer,
      context,
      response,
    }) => {
      vi.mocked(generateDerivedId).mockReturnValue("mocked-notification-id");
      nock(PRIVATE_GATEWAY_ORIGIN)
        .get(NOTIFICATIONS_PATH)
        .replyWithError("ECONNREFUSED");

      const result = await handler(
        eventWithAuthorizer.authenticated(),
        context
          .withPairwiseId()
          .withSecret(mockNotificationSecret)
          .create() as UserGetContext,
      );

      expect(result).toEqual(
        response.internalServerError(
          { message: "Failed to get user info" },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    });
  });
});
