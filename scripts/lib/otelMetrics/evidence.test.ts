import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEvidence } from "./evidence";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "otel-evidence-"));
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("createEvidence", () => {
  it("creates a timestamped folder named after the command", () => {
    const evidence = createEvidence(root, "preflight");
    expect(path.dirname(evidence.directory)).toBe(path.resolve(root));
    expect(path.basename(evidence.directory)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-preflight$/,
    );
    expect(fs.statSync(evidence.directory).isDirectory()).toBe(true);
  });

  it("saves objects as indented JSON and returns the file name", () => {
    const evidence = createEvidence(root, "collect");
    expect(evidence.save("labels.json", { a: [1] })).toBe("labels.json");
    expect(
      fs.readFileSync(path.join(evidence.directory, "labels.json"), "utf8"),
    ).toBe('{\n  "a": [\n    1\n  ]\n}\n');
  });

  it("saves strings unchanged", () => {
    const evidence = createEvidence(root, "collect");
    evidence.save("raw.txt", "as is");
    expect(
      fs.readFileSync(path.join(evidence.directory, "raw.txt"), "utf8"),
    ).toBe("as is");
  });

  it("prints each line and writes them all to summary.md", () => {
    const evidence = createEvidence(root, "cost");
    evidence.line("# Title");
    evidence.line();
    evidence.line("text");
    const file = evidence.finish();
    expect(file).toBe(path.join(evidence.directory, "summary.md"));
    expect(fs.readFileSync(file, "utf8")).toBe("# Title\n\ntext\n");
    expect(console.log).toHaveBeenCalledWith("# Title");
  });

  it("writes a markdown table, escaping pipes and newlines in cells", () => {
    const evidence = createEvidence(root, "collect");
    evidence.table(
      ["Name", "Value"],
      [
        ["a|b", "1"],
        ["c\nd", "2"],
      ],
    );
    expect(fs.readFileSync(evidence.finish(), "utf8")).toBe(
      [
        "| Name | Value |",
        "|---|---|",
        String.raw`| a\|b | 1 |`,
        "| c d | 2 |",
        "",
        "",
      ].join("\n"),
    );
  });
});
