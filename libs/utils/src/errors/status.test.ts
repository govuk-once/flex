import { describe, expect, it } from "vitest";

import { isClientError, isServerError } from "./status";

describe("isClientError", () => {
  it.for([
    { status: 200, expected: false },
    { status: 300, expected: false },
    { status: 400, expected: true },
    { status: 401, expected: true },
    { status: 403, expected: true },
    { status: 404, expected: true },
    { status: 409, expected: true },
    { status: 422, expected: true },
    { status: 429, expected: true },
    { status: 500, expected: false },
    { status: 501, expected: false },
    { status: 502, expected: false },
    { status: 503, expected: false },
  ])("returns $expected for $status", ({ status, expected }) => {
    expect(isClientError(status)).toBe(expected);
  });
});

describe("isServerError", () => {
  it.for([
    { status: 200, expected: false },
    { status: 300, expected: false },
    { status: 400, expected: false },
    { status: 401, expected: false },
    { status: 403, expected: false },
    { status: 404, expected: false },
    { status: 409, expected: false },
    { status: 422, expected: false },
    { status: 429, expected: false },
    { status: 500, expected: true },
    { status: 501, expected: true },
    { status: 502, expected: true },
    { status: 503, expected: true },
  ])("returns $expected for $status", ({ status, expected }) => {
    expect(isServerError(status)).toBe(expected);
  });
});
