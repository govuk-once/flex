import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listE2eModules } from "./listE2eModules";

let root: string;

function writeDomain(name: string, manifest: string) {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "package.json"), manifest);
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "domains-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("listE2eModules", () => {
  it("returns name + package for every domain declaring a test:e2e script", () => {
    writeDomain(
      "uns",
      JSON.stringify({
        name: "@flex/uns-domain",
        scripts: { "test:e2e": "vitest" },
      }),
    );
    writeDomain(
      "dvla",
      JSON.stringify({
        name: "@flex/dvla-domain",
        scripts: { "test:e2e": "vitest" },
      }),
    );

    expect(listE2eModules(root)).toEqual([
      { name: "dvla", package: "@flex/dvla-domain" },
      { name: "uns", package: "@flex/uns-domain" },
    ]);
  });

  it("excludes domains without a test:e2e script", () => {
    writeDomain(
      "no-e2e",
      JSON.stringify({
        name: "@flex/no-e2e-domain",
        scripts: { test: "vitest" },
      }),
    );

    expect(listE2eModules(root)).toEqual([]);
  });

  it("excludes a domain with no package.json", () => {
    mkdirSync(path.join(root, "empty"), { recursive: true });

    expect(listE2eModules(root)).toEqual([]);
  });

  it("skips a malformed package.json without breaking discovery for the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    writeDomain("broken", "{ this is not valid json");
    writeDomain(
      "uns",
      JSON.stringify({
        name: "@flex/uns-domain",
        scripts: { "test:e2e": "vitest" },
      }),
    );

    expect(listE2eModules(root)).toEqual([
      { name: "uns", package: "@flex/uns-domain" },
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("broken"));
  });
});
