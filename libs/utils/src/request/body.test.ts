import { describe, expect, it } from "vitest";
import z from "zod";

import { RequestBodyParseError } from "../errors";
import { resolveRequestBody } from "./body";

describe("resolveRequestBody", () => {
  const schema = z.object({ key: z.string() });

  const body = { key: "value" };
  const stringifiedBody = JSON.stringify(body);

  it("returns undefined when no schema is provided", () => {
    expect(resolveRequestBody(stringifiedBody)).toBeUndefined();
  });

  it("parses a stringified body against the provided schema", () => {
    expect(resolveRequestBody(stringifiedBody, schema)).toStrictEqual({
      key: "value",
    });
  });

  it("returns undefined when the body is null", () => {
    expect(resolveRequestBody(null, schema.optional())).toBeUndefined();
  });

  it("throws RequestBodyParseError when the body is not valid JSON", () => {
    expect(() => resolveRequestBody("{ invalid", schema)).toThrow(
      RequestBodyParseError,
    );
  });

  it("throws RequestBodyParseError when the schema fails to parse the provided body", () => {
    expect(() => resolveRequestBody("{}", schema)).toThrow(
      RequestBodyParseError,
    );
  });

  it("throws all caught errors as RequestBodyParseError", () => {
    const shouldThrow = z.object({ name: z.string() }).transform(() => {
      throw new Error("test error");
    });

    expect(() => {
      resolveRequestBody('{ "name": "test" }', shouldThrow);
    }).toThrow(RequestBodyParseError);
  });
});
