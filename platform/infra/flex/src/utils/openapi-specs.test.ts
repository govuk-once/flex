import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hasGeneratedSpecs } from "./openapi-specs";

describe("hasGeneratedSpecs", () => {
  let folder: string;

  beforeEach(() => {
    folder = mkdtempSync(path.join(tmpdir(), "flex-openapi-"));
  });

  afterEach(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  it("is true when the folder has an index.json", () => {
    writeFileSync(path.join(folder, "index.json"), '{"domains":[]}');

    expect(hasGeneratedSpecs(folder)).toBe(true);
  });

  it("is false when the folder has specs but no index.json", () => {
    writeFileSync(path.join(folder, "example.json"), "{}");

    expect(hasGeneratedSpecs(folder)).toBe(false);
  });

  it("is false when the folder does not exist", () => {
    expect(hasGeneratedSpecs(path.join(folder, "missing"))).toBe(false);
  });
});
