import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUser } from "./createUser";

const mockCreateUser = vi.fn();

vi.mock("../../../client", () => ({
  createUdpDomainClient: () => ({
    gateway: {
      createUser: mockCreateUser,
    },
  }),
}));

describe("createUser", () => {
  const pairwiseId = "test-pairwise-id";
  const notificationId = "test-notification-id";

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateUser.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 201 }),
    );
  });

  it("returns gateway response on success", async () => {
    const response = await createUser({
      privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
      awsRegion: "eu-west-2",
      pairwiseId,
      notificationId,
    });

    expect(response.status).toBe(201);
    expect(mockCreateUser).toHaveBeenCalledWith({ notificationId });
  });

  describe("error handling", () => {
    it("returns gateway 500 response", async () => {
      mockCreateUser.mockResolvedValue(
        new Response(JSON.stringify({ message: "Internal Server Error" }), {
          status: 500,
        }),
      );

      const response = await createUser({
        privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
        awsRegion: "eu-west-2",
        pairwiseId,
        notificationId,
      });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        message: "Internal Server Error",
      });
    });

    it("propagates network errors", async () => {
      mockCreateUser.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(
        createUser({
          privateGatewayUrl: "https://execute-api.eu-west-2.amazonaws.com",
          awsRegion: "eu-west-2",
          pairwiseId,
          notificationId,
        }),
      ).rejects.toThrow();
    });
  });
});
