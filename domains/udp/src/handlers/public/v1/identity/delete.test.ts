import { it } from "@flex/testing";
import { deleteIdentityService } from "@services/identityService";
import createHttpError from "http-errors";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./delete";

vi.mock("../../../../services/identityService", () => ({
  deleteIdentityService: vi.fn(),
}));

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: "https://execute-api.eu-west-2.amazonaws.com",
    }),
  ),
}));

vi.mock("@flex/flex-fetch");

describe("DELETE /identity/:serviceName - service handler", () => {
  const SERVICE = "test-service";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when a service identity is unlinked", () => {
    it("returns 204 No Content when identity is deleted", async ({
      privateGatewayEventWithAuthorizer,
      context,
    }) => {
      vi.mocked(deleteIdentityService).mockResolvedValue(undefined);

      const event = {
        ...privateGatewayEventWithAuthorizer.delete("/identity"),
        pathParameters: {
          serviceName: SERVICE,
        },
      };

      const result = await handler(
        event as Parameters<typeof handler>[0],
        context.withPairwiseId("test-pairwise-id").create(),
      );

      expect(result).toMatchObject({
        statusCode: 204,
        body: undefined,
      });
    });
  });

  describe("service integration", () => {
    it("returns 404 Not Found when deleteIdentityService throws NotFound", async ({
      privateGatewayEventWithAuthorizer,
      context,
      response,
    }) => {
      vi.mocked(deleteIdentityService).mockRejectedValue(
        new createHttpError.NotFound("Service link not found"),
      );

      const event = {
        ...privateGatewayEventWithAuthorizer.authenticated(),
        pathParameters: {
          serviceName: SERVICE,
        },
      } as Parameters<typeof handler>[0];

      const result = await handler(event, context.withPairwiseId().create());

      expect(result).toEqual(
        response.notFound("Service link not found", {
          headers: {
            "Content-Type": "text/plain",
          },
        }),
      );
    });

    it("bubbles errors (500) from deleteIdentityService", async ({
      privateGatewayEventWithAuthorizer,
      context,
      response,
    }) => {
      vi.mocked(deleteIdentityService).mockRejectedValue(
        new createHttpError.BadGateway(),
      );

      const event = {
        ...privateGatewayEventWithAuthorizer.authenticated(),
        pathParameters: {
          serviceName: SERVICE,
        },
      } as Parameters<typeof handler>[0];

      const result = await handler(event, context.withPairwiseId().create());

      expect(result).toEqual(
        response.internalServerError(null, {
          headers: {},
        }),
      );
    });
  });
});
