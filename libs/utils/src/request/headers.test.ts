import { describe, expect, it } from "vitest";

import { HeaderValidationError } from "../errors";
import { mergeHeaders, resolveHeaders } from "./headers";

describe("mergeHeaders", () => {
  it("returns undefined when common and override headers are both missing", () => {
    expect(mergeHeaders()).toBeUndefined();
  });

  it("returns undefined when common and override headers are both empty", () => {
    expect(mergeHeaders({}, {})).toBeUndefined();
  });

  it("returns common headers when override headers are empty", () => {
    expect(mergeHeaders({ commonKey: { name: "x-common" } }, {})).toStrictEqual(
      { commonKey: { name: "x-common" } },
    );
  });

  it("returns override headers when common headers are empty", () => {
    expect(
      mergeHeaders({}, { overrideKey: { name: "x-override" } }),
    ).toStrictEqual({ overrideKey: { name: "x-override" } });
  });

  it("merges common headers with override headers", () => {
    expect(
      mergeHeaders(
        { commonKey: { name: "x-common" } },
        { overrideKey: { name: "x-override" } },
      ),
    ).toStrictEqual({
      commonKey: { name: "x-common" },
      overrideKey: { name: "x-override" },
    });
  });

  it("override headers replace common headers where keys conflict", () => {
    expect(
      mergeHeaders(
        { key: { name: "x-common" } },
        { key: { name: "x-override" } },
      ),
    ).toStrictEqual({ key: { name: "x-override" } });
  });
});

describe("resolveHeaders", () => {
  it("returns undefined when the header config is missing", () => {
    expect(resolveHeaders({ key: "value" })).toBeUndefined();
  });

  it("returns an empty object when the header config is empty", () => {
    expect(resolveHeaders({ key: "value" }, {})).toStrictEqual({});
  });

  it("returns headers using the configured headers from the incoming request headers", () => {
    expect(
      resolveHeaders(
        { "x-a": "value", "x-b": "value" },
        { a: { name: "x-a" }, b: { name: "x-b" } },
      ),
    ).toStrictEqual({ a: "value", b: "value" });
  });

  it("resolves headers case-insensitively", () => {
    expect(
      resolveHeaders({ "X-KEY": "value" }, { key: { name: "x-key" } }),
    ).toStrictEqual({ key: "value" });
  });

  it("skips request headers that are not included in the header config", () => {
    expect(
      resolveHeaders(
        { "x-a": "value", "x-b": "value", "x-c": "value" },
        { key: { name: "x-a" } },
      ),
    ).toStrictEqual({ key: "value" });
  });

  it.for([
    { input: {}, reason: "request headers are an empty object" },
    { input: undefined, reason: "request headers are omitted" },
  ])("sets an optional header to undefined when $reason", ({ input }) => {
    expect(
      resolveHeaders(input, {
        optional: { name: "x-optional", required: false },
      }),
    ).toStrictEqual({ optional: undefined });
  });

  it.for([
    { input: {}, reason: "is missing" },
    { input: { "x-key": undefined }, reason: "value is undefined" },
    { input: { "x-key": "" }, reason: "value is an empty string" },
  ])(
    "throws HeaderValidationError when a required header $reason",
    ({ input }) => {
      expect(() => resolveHeaders(input, { key: { name: "x-key" } })).toThrow(
        HeaderValidationError,
      );
    },
  );

  it("lists every missing required header on the error", () => {
    const call = () =>
      resolveHeaders({}, { a: { name: "x-a" }, b: { name: "x-b" } });

    expect(call).toThrow(HeaderValidationError);
    expect(call).toThrow(expect.objectContaining({ headers: ["x-a", "x-b"] }));
  });
});
