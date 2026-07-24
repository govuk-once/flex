import { describe, expect, it } from "vitest";

import { parseBucketList } from "./s3SecureTransport";

describe("parseBucketList", () => {
  it("returns an empty array for undefined", () => {
    expect(parseBucketList(undefined)).toEqual([]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseBucketList("")).toEqual([]);
  });

  it("splits a comma-separated list", () => {
    expect(parseBucketList("bucket-a,bucket-b,bucket-c")).toEqual([
      "bucket-a",
      "bucket-b",
      "bucket-c",
    ]);
  });

  it("trims surrounding whitespace from each name", () => {
    expect(parseBucketList("  bucket-a ,bucket-b,  bucket-c  ")).toEqual([
      "bucket-a",
      "bucket-b",
      "bucket-c",
    ]);
  });

  it("returns a single name unchanged", () => {
    expect(parseBucketList("only-one")).toEqual(["only-one"]);
  });

  it("drops empty entries from stray commas", () => {
    expect(parseBucketList("bucket-a,,bucket-b,")).toEqual([
      "bucket-a",
      "bucket-b",
    ]);
  });

  it("returns an empty array when the input is only whitespace and commas", () => {
    expect(parseBucketList(" , , ")).toEqual([]);
  });

  it("removes duplicate names, preserving first-seen order", () => {
    expect(parseBucketList("dup, dup , keep")).toEqual(["dup", "keep"]);
  });
});
