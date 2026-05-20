import { describe, expect, it } from "vitest";

import { normaliseHeaders } from "./normalise-headers";

describe("normaliseHeaders", () => {
  it("converts a Headers instance to an object", () => {
    expect(
      normaliseHeaders(new Headers({ "x-a": "value-a", "x-b": "value-b" })),
    ).toStrictEqual({ "x-a": "value-a", "x-b": "value-b" });
  });

  it("returns an empty object when the Headers instance is empty", () => {
    expect(normaliseHeaders(new Headers())).toStrictEqual({});
  });

  it("converts an array of headers to an object", () => {
    expect(
      normaliseHeaders([
        ["x-a", "value-a"],
        ["x-b", "value-b"],
      ]),
    ).toStrictEqual({ "x-a": "value-a", "x-b": "value-b" });
  });

  it("returns an empty object when an empty array is passed", () => {
    expect(normaliseHeaders([])).toStrictEqual({});
  });

  it("returns an empty object when no headers are passed", () => {
    const result = normaliseHeaders(undefined);

    expect(result).toStrictEqual({});
  });
});
