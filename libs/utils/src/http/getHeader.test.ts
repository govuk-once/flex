import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { getHeader } from "./getHeader";

describe("getHeader", () => {
  it.for([
    {
      description: "returns the value of the header",
      headers: { "x-test": "test" },
      name: "x-test",
      expected: "test",
    },
    {
      description: "returns undefined if the header is not found",
      headers: { "x-test": "test" },
      name: "x-not-found",
      expected: undefined,
    },
    {
      description: "returns the value of the header in lowercase",
      headers: { "x-test": "test" },
      name: "x-test",
      expected: "test",
    },
    {
      description: "ignores case of the header name",
      headers: { "x-test": "test" },
      name: "x-test",
      expected: "test",
    },
  ])("$description", ({ headers, name, expected }, { privateGatewayEvent }) => {
    expect(getHeader(privateGatewayEvent.create({ headers }), name)).toBe(
      expected,
    );
  });
});
