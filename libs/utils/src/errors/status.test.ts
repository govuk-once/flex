import { describe, expect, it } from "vitest";

import { isClientError, isServerError } from "./status";

describe("isClientError", () => {
  it.for([
    { status: 399, expected: false },
    { status: 400, expected: true },
    { status: 404, expected: true },
    { status: 499, expected: true },
    { status: 500, expected: false },
  ])("returns $expected for $status", ({ status, expected }) => {
    expect(isClientError(status)).toBe(expected);
  });
});

describe("isServerError", () => {
  it.for([
    { status: 499, expected: false },
    { status: 500, expected: true },
    { status: 501, expected: true },
  ])("returns $expected for $status", ({ status, expected }) => {
    expect(isServerError(status)).toBe(expected);
  });
});
