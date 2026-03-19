import { it } from "@flex/testing";
import { getIdentityService } from "@services/identityService";
import { beforeEach, describe, expect, vi } from "vitest";

import { handler } from "./get";

vi.mock("../../../../services/identityService", () => ({
  getIdentityService: vi.fn(),
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

describe("GET /identity/:serviceName - service handler", () => {
  const SERVICE = "test-service";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when service identity is requested", () => {
    it("returns 200 OK when identity is found", async ({
      response,
      privateGatewayEventWithAuthorizer,
      context,
    }) => {
      const mockedData = {
        linked: true,
      };

      vi.mocked(getIdentityService).mockResolvedValue(mockedData);

      const event = {
        ...privateGatewayEventWithAuthorizer.get(`/identity/${SERVICE}`),
        pathParameters: {
          serviceName: SERVICE,
        },
      };

      const result = await handler(
        event as Parameters<typeof handler>[0],
        context.withPairwiseId("test-pairwise-id").create(),
      );

      expect(result).toEqual(
        response.ok(JSON.stringify(mockedData), {
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
    });
  });

  describe("service integration", () => {
    it("returns 500 Bad Request when upstream service fails", async ({
      privateGatewayEventWithAuthorizer,
      context,
      response,
    }) => {
      const error = new Error("getIdentityService failed");
      vi.mocked(getIdentityService).mockImplementation(() =>
        Promise.reject(error),
      );

      const event = {
        ...privateGatewayEventWithAuthorizer.authenticated(),
        pathParameters: {
          serviceName: SERVICE,
        },
      } as Parameters<typeof handler>[0];

      await expect(
        handler(event, context.withPairwiseId().create()),
      ).resolves.toEqual(
        response.internalServerError(null, {
          headers: {},
        }),
      );
    });
  });
});
