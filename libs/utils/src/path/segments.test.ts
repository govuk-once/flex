import { describe, expect, it } from "vitest";

import {
  isCanonicalPath,
  joinPathSegments,
  matchPathSegments,
  splitPathSegments,
} from "./segments";

describe("splitPathSegments", () => {
  it.for([
    { input: "/v1/example", expected: ["v1", "example"] },
    { input: "/v1/example/:id", expected: ["v1", "example", ":id"] },
  ])("returns $expected for $input", ({ input, expected }) => {
    expect(splitPathSegments(input)).toStrictEqual(expected);
  });

  it.for([
    { input: undefined as never, reason: "is missing" },
    { input: "", reason: "is an empty string" },
    { input: "/", reason: "has no segments" },
  ])("returns an empty array when the path $reason", ({ input }) => {
    expect(splitPathSegments(input)).toStrictEqual([]);
  });
});

describe("joinPathSegments", () => {
  it.for([
    { input: ["v1", "example"], expected: "/v1/example" },
    { input: ["v1", "example", ":id"], expected: "/v1/example/:id" },
    { input: [], expected: "/" },
  ])("returns $expected for $input", ({ input, expected }) => {
    expect(joinPathSegments(input)).toBe(expected);
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
    {
      route: ["v1", "example", ":id"],
      request: ["v1", "example"],
      reason: "a path parameter segment is missing",
    },
  ])("returns null when $reason", ({ route, request }) => {
    expect(matchPathSegments(route, request)).toBeNull();
  });
});

describe("isCanonicalPath", () => {
  it.for(["/", "/v1", "/v1/example", "/v1/example/:id"])(
    "returns true for %s",
    (path) => {
      expect(isCanonicalPath(path)).toBe(true);
    },
  );

  it.for([
    { path: undefined as never, reason: "the path is missing" },
    { path: "", reason: "the path is empty" },
    { path: "v1/example", reason: "there is no leading slash" },
    { path: "/v1/example/", reason: "there is a trailing slash" },
    { path: "//v1/example", reason: "the leading slash is duplicated" },
    { path: "/v1//example", reason: "an inner slash is duplicated" },
    { path: "/v1/example//", reason: "the trailing slash is duplicated" },
  ])("returns false when $reason", ({ path }) => {
    expect(isCanonicalPath(path)).toBe(false);
  });
});
