import type { ApiResult } from "@flex/sdk";
import { describe, expect, it, vi } from "vitest";

import { mapApiResult } from "./result";

describe("mapApiResult", () => {
  it("transforms the data of a success result", () => {
    const result: ApiResult<{ key: string }> = {
      ok: true,
      status: 200,
      data: { key: "value" },
    };

    expect(mapApiResult(result, ({ key }) => ({ updated: key }))).toStrictEqual(
      { ...result, data: { updated: "value" } },
    );
  });

  it("returns an error result unchanged and does not call the transform", () => {
    const result: ApiResult<never> = {
      ok: false,
      error: { status: 404, message: "not found", body: { detail: "x" } },
    };

    const mockTransform = vi.fn();

    expect(mapApiResult(result, mockTransform)).toStrictEqual(result);
    expect(mockTransform).not.toHaveBeenCalled();
  });
});
