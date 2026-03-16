import { it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { cache } from "./cache";

describe("cache", () => {
  it("returns the cached result on subsequent calls", () => {
    const fn = vi.fn(() => "called");

    const cached = cache(fn);

    expect(cached()).toBe("called");
    expect(cached()).toBe("called");
    expect(fn).toHaveBeenCalledOnce();
  });
});
