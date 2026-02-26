import type { APIGatewayProxyEvent } from "aws-lambda";
import { describe, expect, it } from "vitest";

import { getHeader } from "./getHeader";

function eventWithHeaders(
  headers: Record<string, string> | null,
): APIGatewayProxyEvent {
  return { headers } as APIGatewayProxyEvent;
}

describe("getHeader", () => {
  it.each([
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
      headers: { "x-TeSt": "test" },
      name: "x-test",
      expected: "test",
    },
    {
      description: "returns undefined if the headers are null",
      headers: null,
      name: "x-test",
      expected: undefined,
    },
  ])("$description", ({ headers, name, expected }) => {
    expect(
      getHeader(
        eventWithHeaders(headers as Record<string, string> | null),
        name,
      ),
    ).toBe(expected);
  });
});
