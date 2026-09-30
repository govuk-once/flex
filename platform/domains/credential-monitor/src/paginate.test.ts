import { describe, expect, it, vi } from "vitest";

import { collectPages, type Page } from "./paginate";

describe("collectPages", () => {
  it("returns the items of a single page", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({ items: [1, 2] });

    await expect(collectPages(fetchPage)).resolves.toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("follows next tokens and keeps the page order", async () => {
    const pages: Record<string, Page<string>> = {
      start: { items: ["a"], nextToken: "second" },
      second: { items: ["b", "c"], nextToken: "third" },
      third: { items: ["d"] },
    };
    const fetchPage = vi.fn((token?: string) =>
      Promise.resolve(pages[token ?? "start"] ?? { items: [] }),
    );

    await expect(collectPages(fetchPage)).resolves.toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(fetchPage.mock.calls).toEqual([[undefined], ["second"], ["third"]]);
  });

  it("keeps paging through an empty intermediate page", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [], nextToken: "next" })
      .mockResolvedValueOnce({ items: ["a"] });

    await expect(collectPages(fetchPage)).resolves.toEqual(["a"]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list when there are no items", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({ items: [] });

    await expect(collectPages(fetchPage)).resolves.toEqual([]);
  });

  it("rejects when a page fails", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: ["a"], nextToken: "next" })
      .mockRejectedValueOnce(new Error("ThrottlingException"));

    await expect(collectPages(fetchPage)).rejects.toThrow(
      "ThrottlingException",
    );
  });
});
