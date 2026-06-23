import { describe, expect, it } from "vitest";

import { assertNever } from "./assert";

describe("assertNever", () => {
  it("throws with the serialised value in the message", () => {
    expect(() => assertNever("error" as never)).toThrow(
      'Unexpected value: "error"',
    );
  });
});
