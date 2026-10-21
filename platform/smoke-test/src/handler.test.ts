import { describe, expect, it, vi } from "vitest";

import {
  UNSIGNED_PROBE_ZIP,
  verifyUnsignedDeploymentRejected,
} from "./handler";

describe("verifyUnsignedDeploymentRejected", () => {
  it("succeeds when AWS Lambda rejects the unsigned zip with CodeVerificationFailedException", async () => {
    const codeVerificationError = Object.assign(
      new Error(
        "Lambda cannot deploy the function. The function or layer might be signed using a signature that the client is not configured to accept.",
      ),
      { name: "CodeVerificationFailedException" },
    );
    const mockClient = {
      send: vi.fn().mockRejectedValueOnce(codeVerificationError),
    };

    await expect(
      verifyUnsignedDeploymentRejected(
        "development-FlexSmokeTest-SmokeTestFunction",
        mockClient,
      ),
    ).resolves.toBeUndefined();

    expect(mockClient.send).toHaveBeenCalledOnce();
    const command = mockClient.send.mock.calls[0]?.[0] as {
      input: { FunctionName: string; ZipFile: Buffer };
    };
    expect(command.input).toEqual({
      FunctionName: "development-FlexSmokeTest-SmokeTestFunction",
      ZipFile: UNSIGNED_PROBE_ZIP,
    });
  });

  it("throws a security violation error if AWS Lambda accepts the unsigned zip", async () => {
    const mockClient = {
      send: vi.fn().mockResolvedValueOnce({}),
    };

    await expect(
      verifyUnsignedDeploymentRejected(
        "development-FlexSmokeTest-SmokeTestFunction",
        mockClient,
      ),
    ).rejects.toThrow(/Security violation: unsigned code deployment/);
  });

  it("rethrows unexpected AWS errors that are not code-signing rejections", async () => {
    const accessDeniedError = Object.assign(new Error("Access Denied"), {
      name: "AccessDeniedException",
    });
    const mockClient = {
      send: vi.fn().mockRejectedValueOnce(accessDeniedError),
    };

    await expect(
      verifyUnsignedDeploymentRejected(
        "development-FlexSmokeTest-SmokeTestFunction",
        mockClient,
      ),
    ).rejects.toThrow(
      /failed with unexpected error \(AccessDeniedException\): Access Denied/,
    );
  });
});
