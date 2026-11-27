import { describe, expect, it } from "vitest";

import {
  extractCorrelationId,
  getCorrelationId,
  runWithCorrelationId,
} from ".";

describe("extractCorrelationId", () => {
  it("returns the lowercase header value", () => {
    expect(extractCorrelationId({ "x-correlation-id": "abc" })).toBe("abc");
  });

  it("matches the header name case-insensitively", () => {
    expect(extractCorrelationId({ "X-Correlation-Id": "abc" })).toBe("abc");
  });

  it.each([undefined, null, {}, { "x-other": "abc" }])(
    "returns undefined when the header is absent (%o)",
    (headers) => {
      expect(extractCorrelationId(headers)).toBeUndefined();
    },
  );

  it("returns undefined for an empty value", () => {
    expect(extractCorrelationId({ "x-correlation-id": "" })).toBeUndefined();
  });
});

describe("runWithCorrelationId", () => {
  it("exposes the id to sync and async work inside the callback", async () => {
    const result = await runWithCorrelationId("abc", async () => {
      expect(getCorrelationId()).toBe("abc");
      await new Promise((resolve) => setTimeout(resolve, 0));
      return getCorrelationId();
    });

    expect(result).toBe("abc");
  });

  it("isolates concurrent invocations", async () => {
    const read = (id: string) =>
      runWithCorrelationId(id, async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return getCorrelationId();
      });

    await expect(Promise.all([read("a"), read("b")])).resolves.toEqual([
      "a",
      "b",
    ]);
  });

  it("returns undefined outside a correlation context", () => {
    expect(getCorrelationId()).toBeUndefined();
  });
});
