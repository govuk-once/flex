import { it } from "@flex/testing";
import nock from "nock";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./post";

const PRIVATE_GATEWAY_ORIGIN = "https://execute-api.eu-west-2.amazonaws.com";
const PRIVATE_GATEWAY_BASE_URL = `${PRIVATE_GATEWAY_ORIGIN}/gateways/udp`;
const USER_PATH = "/gateways/udp/v1/user";

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: PRIVATE_GATEWAY_ORIGIN,
    }),
  ),
}));
vi.mock("aws-sigv4-fetch", () => ({
  createSignedFetcher: vi.fn(() => fetch),
}));

describe("post handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nock.cleanAll();
  });

  describe("successful user creation", () => {
    it("returns 201 when user is created successfully", async ({
      response,
      internalEvent,
      context,
    }) => {
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(USER_PATH, {
          notificationId: "test-notification-id",
          appId: "test-app-id",
        })
        .reply(201, {});

      const result = await handler(
        internalEvent.post("/user", {
          body: {
            notificationId: "test-notification-id",
            appId: "test-app-id",
          },
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(
        response.created(
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

  describe("invalid payload", () => {
    it.for([
      {
        body: { notificationId: "id" },
        desc: "missing appId",
      },
      {
        body: { appId: "app" },
        desc: "missing notificationId",
      },
      {
        body: {},
        desc: "missing both notificationId and appId",
      },
      {
        body: { notificationId: 123, appId: "app" },
        desc: "notificationId not a string",
      },
      {
        body: { notificationId: "id", appId: null },
        desc: "appId null",
      },
    ])(
      "rejects invalid payload: $desc",
      async ({ body }, { internalEvent, context }) => {
        const result = await handler(
          internalEvent.post("/user", { body }),
          context.withPairwiseId().create(),
        );

        expect(result).toEqual(expect.objectContaining({ statusCode: 400 }));
      },
    );
  });

  describe("API errors", () => {
    it("returns 500 when API returns non-OK", async ({
      response,
      internalEvent,
      context,
    }) => {
      nock(PRIVATE_GATEWAY_ORIGIN)
        .post(USER_PATH)
        .reply(500, { message: "Internal Server Error" });

      const result = await handler(
        internalEvent.post("/user", {
          body: {
            notificationId: "test-notification-id",
            appId: "test-app-id",
          },
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(
        response.internalServerError(
          {
            message: "Internal Server Error",
          },
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    });
  });
});
