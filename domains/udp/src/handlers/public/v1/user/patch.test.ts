import type { ContextWithPairwiseId } from "@flex/middlewares";
import { it } from "@flex/testing";
import nock from "nock";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  vi,
} from "vitest";

import { handler, type NotificationSecretContext } from "./patch";

const mockGenerateDerivedId = vi.hoisted(() => vi.fn());

type UserPatchContext = ContextWithPairwiseId & NotificationSecretContext;

vi.mock("../../../../service/derived-id", () => ({
  generateDerivedId: (...args: unknown[]) =>
    mockGenerateDerivedId(...args) as never,
}));
vi.mock("@flex/middlewares");
vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: "https://execute-api.eu-west-2.amazonaws.com",
    }),
  ),
}));

vi.mock("@flex/flex-fetch", async (actual) => ({
  ...(await actual()),
  createSigv4Fetcher:
    ({ baseUrl }: { baseUrl: string }) =>
    (path: string, options?: RequestInit) => ({
      request: fetch(`${baseUrl}${path}`, options),
      abort: vi.fn(),
    }),
}));

describe("Public PATCH /user handler", () => {
  const BASE_URL = "https://execute-api.eu-west-2.amazonaws.com";

  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(nock.isDone()).toBe(true);
    nock.cleanAll();
  });

  describe("when user preferences are updated successfully", () => {
    const derivedNotificationId = "derived-notification-id";

    beforeEach(() => {
      mockGenerateDerivedId.mockReturnValue(derivedNotificationId);
    });

    it("derives notificationId and passes it to the private handler", async ({
      response,
      privateGatewayEventWithAuthorizer,
      context,
    }) => {
      nock(BASE_URL)
        .patch("/gateways/udp/v1/notifications", {
          consentStatus: "accepted",
          notificationId: derivedNotificationId,
        })
        .reply(200, {
          consentStatus: "accepted",
          notificationId: derivedNotificationId,
        });

      const request = await handler(
        privateGatewayEventWithAuthorizer.patch("/user", {
          body: {
            consentStatus: "accepted",
          },
        }),
        context
          .withPairwiseId()
          .withSecret({ notificationSecretKey: "test-secret" }) // pragma: allowlist secret
          .create() as UserPatchContext,
      );

      expect(mockGenerateDerivedId).toHaveBeenCalledWith({
        pairwiseId: "test-pairwise-id",
        secretKey: "test-secret", // pragma: allowlist secret
      });
      expect(request).toEqual(
        response.ok(
          {
            consentStatus: "accepted",
            notificationId: derivedNotificationId,
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

  it.for([
    {
      body: {
        consentStatus: "yes",
      },
      description: "unknown consent status",
    },
    {
      body: {},
      description: "missing consent status",
    },
  ])(
    "rejects invalid payload: $description",
    async ({ body }, { privateGatewayEventWithAuthorizer, context }) => {
      mockGenerateDerivedId.mockReturnValue("derived-id");
      const result = await handler(
        privateGatewayEventWithAuthorizer.patch("/user", { body }),
        context
          .withPairwiseId()
          .withSecret({ notificationSecretKey: "test-secret" }) // pragma: allowlist secret
          .create() as UserPatchContext,
      );

      expect(result).toEqual(expect.objectContaining({ statusCode: 400 }));
    },
  );
});
