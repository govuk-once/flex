import { it } from "@flex/testing";
import createHttpError from "http-errors";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./post";

const mockCreateUser = vi.hoisted(() => vi.fn());

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: "https://execute-api.eu-west-2.amazonaws.com",
    }),
  ),
}));
vi.mock("../../../../client", () => ({
  createUdpDomainClient: vi.fn(() => ({
    gateway: {
      createUser: mockCreateUser,
    },
  })),
}));

describe("post handler", () => {
  beforeEach(() => {
    mockCreateUser.mockReset();
    mockCreateUser.mockResolvedValue(new Response(null, { status: 204 }));
  });

  describe("successful user creation", () => {
    it("returns 204 when user is created successfully", async ({
      response,
      privateGatewayEvent,
      context,
    }) => {
      const result = await handler(
        privateGatewayEvent.post("/user", {
          body: {
            notificationId: "test-notification-id",
            appId: "test-app-id",
          },
        }),
        context.withPairwiseId().create(),
      );

      expect(result).toEqual(
        response.noContent({
          headers: { "Content-Type": "application/json" },
        }),
      );
      expect(mockCreateUser).toHaveBeenCalledExactlyOnceWith({
        notificationId: "test-notification-id",
        appId: "test-app-id",
      });
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
      async ({ body }, { privateGatewayEvent, context }) => {
        const result = await handler(
          privateGatewayEvent.post("/user", { body }),
          context.withPairwiseId().create(),
        );

        expect(result).toEqual(expect.objectContaining({ statusCode: 400 }));
      },
    );
  });

  describe("API errors", () => {
    it("returns InternalServerError when API returns non-OK", async ({
      privateGatewayEvent,
      context,
    }) => {
      mockCreateUser.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Internal Server Error" }), {
          status: 500,
        }),
      );

      const result = await handler(
        privateGatewayEvent.post("/user", {
          body: {
            notificationId: "test-notification-id",
            appId: "test-app-id",
          },
        }),
        context.withPairwiseId().create(),
      );

      expect(createHttpError.isHttpError(result)).toBe(true);
      expect(result).toBeInstanceOf(createHttpError.InternalServerError);
      expect(result).toMatchObject({ message: "Internal Server Error" });
    });
  });
});
