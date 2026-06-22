import { describe, expect, it } from "vitest";

import { splitRouteKey, splitVersionedPath } from "./route";

describe("splitRouteKey", () => {
  it.for([
    { input: "GET /v1/example", expected: ["GET", "/v1/example"] },
    { input: "GET /v1/example/:id", expected: ["GET", "/v1/example/:id"] },
  ])("returns $expected for $input", ({ input, expected }) => {
    expect(splitRouteKey(input)).toStrictEqual(expected);
  });

  it.for([
    { input: undefined as unknown as string, reason: "missing" },
    { input: "", reason: "an empty string" },
    { input: "GET", reason: "missing a path" },
    { input: "/v1/example", reason: "missing a method" },
  ])("returns null when the value is $reason", ({ input }) => {
    expect(splitRouteKey(input)).toBeNull();
  });
});

describe("splitVersionedPath", () => {
  it.for([
    { input: "/v1/example", expected: ["v1", "/example"] },
    { input: "/v1/example/path", expected: ["v1", "/example/path"] },
  ])("returns $expected for $input", ({ input, expected }) => {
    expect(splitVersionedPath(input)).toStrictEqual(expected);
  });

  it.for([
    { input: undefined as unknown as string, reason: "missing" },
    { input: "", reason: "an empty string" },
    { input: "/v1", reason: "missing a path" },
  ])("returns null when the value is $reason", ({ input }) => {
    expect(splitVersionedPath(input)).toBeNull();
  });
});
