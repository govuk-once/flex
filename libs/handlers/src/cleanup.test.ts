import { it } from "@flex/testing";
import fs, { readdirSync, rmSync } from "fs";
import { vol } from "memfs";
import { describe, expect, vi, vitest } from "vitest";

import { clearTmp } from "./cleanup";

vitest.mock("node:fs", async () => {
  const fs = await import("memfs");
  return fs;
});

describe("clearTmp", () => {
  it("should clear all files in the /tmp directory", ({ env }) => {
    env.set({ NODE_ENV: "production" });

    vol.fromJSON({
      "/tmp/file1.txt": "content1",
      "/tmp/file2.txt": "content2",
    });

    vi.spyOn(fs, "readdirSync");
    vi.spyOn(fs, "rmSync");

    clearTmp();

    expect(readdirSync).toHaveBeenCalledWith("/tmp");
    expect(rmSync).toHaveBeenCalledWith("/tmp/file1.txt", {
      recursive: true,
      force: true,
    });
    expect(rmSync).toHaveBeenCalledWith("/tmp/file2.txt", {
      recursive: true,
      force: true,
    });
  });
});
