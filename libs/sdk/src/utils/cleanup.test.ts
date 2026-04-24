import { it } from "@flex/testing";
import fs, { readdirSync, rmSync } from "fs";
import { vol } from "memfs";
import { beforeEach, describe, expect, vi, vitest } from "vitest";

import { clearTmp } from "./cleanup";

vitest.mock("@flex/logging");
vitest.mock("node:fs", async () => {
  const fs = await import("memfs");
  return fs;
});

beforeEach(() => {
  vol.reset();
  vi.clearAllMocks();
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

    expect(readdirSync).toHaveBeenCalledExactlyOnceWith("/tmp");
    expect(rmSync).toHaveBeenCalledTimes(2);
    expect(rmSync).toHaveBeenCalledWith("/tmp/file1.txt", {
      recursive: true,
      force: true,
    });
    expect(rmSync).toHaveBeenCalledWith("/tmp/file2.txt", {
      recursive: true,
      force: true,
    });
  });

  it("should not clear files in /tmp when NODE_ENV is test", ({ env }) => {
    env.set({ NODE_ENV: "test" });

    vol.fromJSON({
      "/tmp/file1.txt": "content1",
      "/tmp/file2.txt": "content2",
    });

    vi.spyOn(fs, "readdirSync");
    vi.spyOn(fs, "rmSync");

    clearTmp();

    expect(readdirSync).not.toHaveBeenCalled();
    expect(rmSync).not.toHaveBeenCalled();
  });
});
