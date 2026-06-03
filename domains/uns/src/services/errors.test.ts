import { describe, expect, it } from "vitest";

import { throwIntegrationError } from "./errors";

describe("throwIntegrationError", () => {
  it.for([
    { reason: "is a bad request", status: 400, expected: 400 },
    { reason: "is not found", status: 404, expected: 404 },
    { reason: "is rate limited", status: 429, expected: 429 },
    { reason: "is unexpected", status: 500, expected: 502 },
  ])(
    "throws a $expected when the upstream status $reason",
    ({ status, expected }) => {
      expect(() => throwIntegrationError(status)).toThrow(
        expect.objectContaining({ status: expected }),
      );
    },
  );
});
