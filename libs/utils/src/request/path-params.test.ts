import { describe, expect, it } from "vitest";

import { resolvePathParams } from "./path-params";

describe("resolvePathParams", () => {
  it.for([
    { reason: "params are missing", params: undefined as never },
    { reason: "params are null", params: null },
    { reason: "params are empty", params: {} },
  ])("returns undefined when $reason", ({ params }) => {
    expect(resolvePathParams(params)).toBeUndefined();
  });

  it("returns the params as a plain object and removes entries with undefined values", () => {
    expect(resolvePathParams({ a: "a", b: "b", c: undefined })).toStrictEqual({
      a: "a",
      b: "b",
    });
  });
});
