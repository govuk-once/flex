import { describe, expect, it } from "vitest";

import { isUuidV4, requestIdToUuidV4 } from "./uuid";

describe("requestIdToUuidV4", () => {
  const samples = [
    "",
    "4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ==", // pragma: allowlist secret
    "req-1",
    "req-2",
    "a".repeat(100),
    "🙂 unicode requestId",
  ];

  it.each(samples)("produces a valid v4 for %j", (requestId: string) => {
    expect(isUuidV4(requestIdToUuidV4(requestId))).toBe(true);
  });

  it.each(samples)("is deterministic for %j", (requestId: string) => {
    expect(requestIdToUuidV4(requestId)).toBe(requestIdToUuidV4(requestId));
  });

  it("maps a known requestId to a stable uuid", () => {
    expect(
      requestIdToUuidV4(
        "4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ==", // pragma: allowlist secret
      ),
    ).toBe("97575440-1476-47ab-ae7b-627690dfb745");
  });
});

describe("isUuidV4", () => {
  it.each<[string, string, boolean]>([
    ["known-good v4", "f47ac10b-58cc-4372-a567-0e02b2c3d479", true],
    ["uppercase v4", "F47AC10B-58CC-4372-A567-0E02B2C3D479", true],
    ["variant 8", "f47ac10b-58cc-4372-8567-0e02b2c3d479", true],
    ["variant 9", "f47ac10b-58cc-4372-9567-0e02b2c3d479", true],
    ["variant a", "f47ac10b-58cc-4372-a567-0e02b2c3d479", true],
    ["variant b", "f47ac10b-58cc-4372-b567-0e02b2c3d479", true],
    ["v1 (wrong version)", "f47ac10b-58cc-1372-a567-0e02b2c3d479", false],
    ["v7 (wrong version)", "017f22e2-79b0-7cc3-98c4-dc0c0c07398f", false],
    ["variant c (invalid)", "f47ac10b-58cc-4372-c567-0e02b2c3d479", false],
    ["variant 7 (invalid)", "f47ac10b-58cc-4372-7567-0e02b2c3d479", false],
    ["nil uuid", "00000000-0000-0000-0000-000000000000", false],
    ["max uuid", "ffffffff-ffff-ffff-ffff-ffffffffffff", false],
    ["trailing newline", "f47ac10b-58cc-4372-a567-0e02b2c3d479\n", false],
    ["braced guid", "{f47ac10b-58cc-4372-a567-0e02b2c3d479}", false],
    ["too short", "f47ac10b-58cc-4372-a567-0e02b2c3d47", false],
    ["empty string", "", false],
  ])("%s -> %s", (_label: string, value: string, expected: boolean) => {
    expect(isUuidV4(value)).toBe(expected);
  });
});
