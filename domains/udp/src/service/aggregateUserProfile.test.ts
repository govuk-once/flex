import { describe, expect, it, vi } from "vitest";

import { aggregateUserProfile } from "./aggregateUserProfile";
import { createUserOrchestrator } from "./createUser";
import { getUserSettings } from "./getUserSettings";

vi.mock("./getUserSettings", () => ({
  getUserSettings: vi.fn(),
}));
vi.mock("./createUser", () => ({
  createUserOrchestrator: vi.fn(),
}));
vi.mock("@flex/logging", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("aggregateUserProfile", () => {
  const baseUrl = new URL(
    "https://execute-api.eu-west-2.amazonaws.com/gateways/udp",
  );
  const region = "eu-west-2";
  const pairwiseId = "test-pairwise-id";
  const notificationId = "test-notification-id";

  it("should aggregate the user profile from the user settings and create a user if they don't exist", async () => {
    await aggregateUserProfile({
      region,
      baseUrl,
      pairwiseId,
      notificationId,
    });
    expect(getUserSettings).toHaveBeenCalledWith({
      region,
      baseUrl,
      pairwiseId,
    });
    expect(getUserSettings).toHaveBeenCalledTimes(2);
    expect(createUserOrchestrator).toHaveBeenCalledWith({
      region,
      baseUrl,
      pairwiseId,
      notificationId,
    });
  });
});
