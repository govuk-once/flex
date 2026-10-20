import { describe, expect, it } from "vitest";

import { createDeterministicZip } from "./deterministic-zip";

describe("createDeterministicZip", () => {
  it("produces identical SHA-256 hashes and buffers across repeated calls", () => {
    const entries = [
      { path: "index.js", content: 'exports.handler = async () => ({ statusCode: 200 });' },
    ];

    const first = createDeterministicZip(entries);
    const second = createDeterministicZip(entries);

    expect(first.sha256).toBe(second.sha256);
    expect(first.buffer.equals(second.buffer)).toBe(true);
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("sorts entries deterministically regardless of input order", () => {
    const orderA = createDeterministicZip([
      { path: "b/helper.js", content: "module.exports = 2;" },
      { path: "a/index.js", content: "module.exports = 1;" },
      { path: "c.json", content: '{"ok":true}' },
    ]);

    const orderB = createDeterministicZip([
      { path: "./c.json", content: '{"ok":true}' },
      { path: "a/index.js", content: "module.exports = 1;" },
      { path: "b\\helper.js", content: "module.exports = 2;" },
    ]);

    expect(orderA.sha256).toBe(orderB.sha256);
    expect(orderA.buffer.equals(orderB.buffer)).toBe(true);
  });

  it("produces a different hash when file content changes", () => {
    const v1 = createDeterministicZip([
      { path: "index.js", content: "exports.handler = async () => 1;" },
    ]);
    const v2 = createDeterministicZip([
      { path: "index.js", content: "exports.handler = async () => 2;" },
    ]);

    expect(v1.sha256).not.toBe(v2.sha256);
  });

  it("throws on empty entry list, duplicate paths, or traversal paths", () => {
    expect(() => createDeterministicZip([])).toThrow(/empty entry list/);

    expect(() =>
      createDeterministicZip([
        { path: "index.js", content: "a" },
        { path: "./index.js", content: "b" },
      ]),
    ).toThrow(/Duplicate zip entry path/);

    expect(() =>
      createDeterministicZip([{ path: "../secret.js", content: "a" }]),
    ).toThrow(/Invalid zip entry path/);
  });
});
