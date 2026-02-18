import { it } from "@flex/testing";
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
vi.mock("../../services/createUser", () => ({
  createUser: mockCreateUser,
}));

describe("post handler", () => {
  beforeEach(() => {
    mockCreateUser.mockReset();
    mockCreateUser.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 201 }),
    );
  });

  describe("successful user creation", () => {
    it("returns 201 when user is created successfully", async ({
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
        response.created(
          {},
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
      expect(mockCreateUser).toHaveBeenCalledWith({
        privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        awsRegion: "eu-west-2",
        pairwiseId: "test-app-id",
        notificationId: "test-notification-id",
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
    it("returns 500 when API returns non-OK", async ({
      response,
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
