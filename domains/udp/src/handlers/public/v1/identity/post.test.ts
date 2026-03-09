import { it } from "@flex/testing";
import { beforeEach, describe, expect, vi } from "vitest";

import { postIdentityService } from "../../../../services/identityService";
import { handler } from "./post";

vi.mock("../../../../services/identityService", () => ({
  postIdentityService: vi.fn(),
}));

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

describe("POST /identity/:service/:identifier - service handler", () => {
  const SERVICE_NAME = "test-service";
  const IDENTIFIER = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when identity service is posted successfully", () => {
    it("returns 201 Created when identity is posted", async ({
      response,
      privateGatewayEventWithAuthorizer,
      context,
    }) => {
      vi.mocked(postIdentityService).mockResolvedValue(undefined);

      const event = {
        ...privateGatewayEventWithAuthorizer.post("/identity", { body: {} }),
        pathParameters: {
          serviceName: SERVICE_NAME,
          identifier: IDENTIFIER,
        },
      };

      const result = await handler(
        event as Parameters<typeof handler>[0],
        context.withPairwiseId("test-pairwise-id").create(),
      );

      expect(result).toEqual(
        response.created(undefined, {
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
    });
  });

  describe("service integration", () => {
    it("bubbles errors from postIdentityService", async ({
      privateGatewayEventWithAuthorizer,
      context,
      response,
    }) => {
      const error = new Error("postIdentityService failed");
      vi.mocked(postIdentityService).mockImplementation(() =>
        Promise.reject(error),
      );

      const event = {
        ...privateGatewayEventWithAuthorizer.authenticated(),
        pathParameters: {
          serviceName: "test-service",
          identifier: "test-identifier",
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
