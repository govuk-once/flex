import type { ContextWithUserId } from "@flex/middlewares";
import { it } from "@flex/testing";
import { getNotificationId } from "@services/getNotificationId";
import { testNotificationId } from "@test/fixtures";
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

import { NotificationSecretContext } from "../../../../schemas/notifications";
import { handler } from "./patch";

type UserPatchContext = ContextWithUserId & NotificationSecretContext;

vi.mock("@services/getNotificationId");
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
    it("derives notificationId and passes it to the private handler", async ({
      response,
      privateGatewayEventWithAuthorizer,
      context,
      userId,
    }) => {
      nock(BASE_URL)
        .post("/gateways/udp/v1/notifications", {
          consentStatus: "accepted",
          notificationId: testNotificationId,
        })
        .reply(200, {
          consentStatus: "accepted",
          notificationId: testNotificationId,
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

      expect(getNotificationId).toHaveBeenCalledWith({
        userId,
        secretKey: "test-secret", // pragma: allowlist secret
      });
      expect(request).toEqual(
        response.ok(
          {
            consentStatus: "accepted",
            notificationId: testNotificationId,
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
