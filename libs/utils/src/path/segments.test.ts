import { describe, expect, it } from "vitest";

import { matchPathSegments, toPathSegments } from "./segments";

describe("toPathSegments", () => {
  it.for([
    { input: "/v1/example", expected: ["v1", "example"] },
    { input: "/v1/example/:id", expected: ["v1", "example", ":id"] },
  ])("returns $expected for $input", ({ input, expected }) => {
    expect(toPathSegments(input)).toStrictEqual(expected);
  });

  it.for([
    { input: undefined as unknown as string, reason: "is missing" },
    { input: "", reason: "is an empty string" },
    { input: "/", reason: "has no segments" },
  ])("returns an empty array when the path $reason", ({ input }) => {
    expect(toPathSegments(input)).toStrictEqual([]);
  });
});

describe("matchPathSegments", () => {
  it.for([
    {
      route: ["v1", "example"],
      request: ["v1", "example"],
      expected: {},
      reason: "segments match without a path param",
    },
    {
      route: ["v1", "example", ":id"],
      request: ["v1", "example", "123"],
      expected: { id: "123" },
      reason: "segments match with a path param",
    },
  ])("returns params when $reason", ({ route, request, expected }) => {
    expect(matchPathSegments(route, request)).toStrictEqual(expected);
  });

  it.for([
    {
      route: ["v1"],
      request: ["v1", "example"],
      reason: "both segment counts do not match",
    },
    {
      route: ["v1", "example"],
      request: ["v1", "other"],
      reason: "a segment entry contains a mismatch",
    },
  ])("returns null when $reason", ({ route, request }) => {
    expect(matchPathSegments(route, request)).toBeNull();
  });
});
