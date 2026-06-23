import { describe, expect, it } from "vitest";
import z from "zod";

import { QueryParametersParseError } from "../errors";
import { resolveQueryParams } from "./query-params";

describe("resolveQueryParams", () => {
  const schema = z.object({ key: z.string() });
  const queryParams = { key: "value" };

  it("returns undefined when no schema is provided", () => {
    expect(resolveQueryParams(queryParams)).toBeUndefined();
  });

  it("parses the query parameters against the provided schema", () => {
    expect(resolveQueryParams(queryParams, schema)).toStrictEqual({
      key: "value",
    });
  });

  it.for([
    {
      reason: "all fields are optional",
      schema: z.object({ key: z.string().optional() }),
      assert: (run: () => unknown) => {
        expect(run()).toStrictEqual({});
      },
    },
    {
      reason: "a required field is missing",
      schema: z.object({ key: z.string() }),
      assert: (run: () => unknown) => {
        expect(run).toThrow(QueryParametersParseError);
      },
    },
  ])(
    "sets missing query parameters as empty and parses when $reason",
    ({ schema, assert }) => {
      assert(() => resolveQueryParams(null, schema));
    },
  );

  it("throws QueryParametersParseError when schema fails to parse the provided query parameters", () => {
    expect(() => resolveQueryParams({}, schema)).toThrow(
      QueryParametersParseError,
    );
  });

  it("throws a non-Zod error", () => {
    const shouldThrow = z.object({ key: z.string() }).transform(() => {
      throw new Error("test error");
    });

    expect(() => resolveQueryParams(queryParams, shouldThrow)).toThrow(
      "test error",
    );
  });
});
