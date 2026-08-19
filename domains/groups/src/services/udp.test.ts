import { beforeEach, describe, expect, it, vi } from "vitest";

import { getUserGroups } from "./udp";

// Mock @domain so routeContext() returns a controlled context in each test
vi.mock("@domain", () => ({
  routeContext: vi.fn(),
}));

import { routeContext } from "@domain";

const mockLogger = {
  debug: vi.fn(),
  error: vi.fn(),
};

const mockUdpGetGroups = vi.fn();

function stubContext() {
  vi.mocked(routeContext).mockReturnValue({
    integrations: { udpGetGroups: mockUdpGetGroups },
    logger: mockLogger,
  } as never);
}

import { userId } from "@flex/testing";
import { groupSubscriptions } from "@tests/fixtures";

const existingGroups = groupSubscriptions;

describe("getUserGroups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubContext();
  });

  it("returns the user's groups when UDP responds with 200", async () => {
    mockUdpGetGroups.mockResolvedValue({
      ok: true,
      data: existingGroups,
    });

    const result = await getUserGroups(userId);

    expect(mockUdpGetGroups).toHaveBeenCalledExactlyOnceWith({
      headers: { "requesting-service-user-id": userId },
    });
    expect(result).toStrictEqual(existingGroups);
  });

  it("returns an empty array when UDP responds with 404", async () => {
    mockUdpGetGroups.mockResolvedValue({
      ok: false,
      error: { status: 404, message: "Not Found" },
    });

    const result = await getUserGroups(userId);

    expect(result).toStrictEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith("User groups not found", {
      userId,
    });
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("throws a 502 BadGateway when UDP responds with a non-404 error", async () => {
    mockUdpGetGroups.mockResolvedValue({
      ok: false,
      error: { status: 500, message: "Internal Server Error" },
    });

    await expect(getUserGroups(userId)).rejects.toMatchObject({
      status: 502,
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to fetch user groups from UDP",
      {
        userId,
        error: { status: 500, message: "Internal Server Error" },
      },
    );
    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
});
