import { sigv4Fetch } from "@flex/utils";
import { describe, expect, it, vi } from "vitest";

import { createUserOrchestrator } from "./createUser";

vi.mock("@flex/logging", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));
vi.mock("@flex/utils", () => ({
  sigv4Fetch: vi.fn(),
}));

describe("createUserOrchestrator", () => {
  it("propagates the error if the private API returns a non-OK response", async () => {
    vi.mocked(sigv4Fetch).mockResolvedValue({
      status: 500,
      statusText: "Internal Server Error",
      headers: new Headers(),
    } as Response);

    await expect(
      createUserOrchestrator({
        region: "eu-west-2",
        baseUrl: new URL(
          "https://execute-api.eu-west-2.amazonaws.com/gateways/udp",
        ),
        pairwiseId: "test-pairwise-id",
        notificationId: "test-notification-id",
      }),
    ).rejects.toThrow();
  });
});
