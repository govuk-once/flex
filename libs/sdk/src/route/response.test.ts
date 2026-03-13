import { it } from "@flex/testing";
import { describe, expect } from "vitest";
import z from "zod";

import { toApiGatewayResponse, validateHandlerResponse } from "./response";

describe("toApiGatewayResponse", () => {
  it.for([
    {
      label: "success response with data",
      input: { status: 200, data: { key: "value" } },
      expected: {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "value" }),
      },
    },
    {
      label: "success response with null data",
      input: { status: 200, data: null },
      expected: {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: "",
      },
    },
    {
      label: "error response with message",
      input: { status: 400, error: { message: "Bad request" } },
      expected: {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: { message: "Bad request" } }),
      },
    },
    {
      label: "error response with null error",
      input: { status: 500, error: null },
      expected: {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: "",
      },
    },
    {
      label: "success response with no-content",
      input: { status: 204 },
      expected: { statusCode: 204, body: "" },
    },
  ])("converts $label to API Gateway response", ({ input, expected }) => {
    expect(toApiGatewayResponse(input)).toStrictEqual(expected);
  });
});

describe("validateHandlerResponse", () => {
  const schema = z.object({ key: z.literal("test") });

  it.for([
    {
      label: "no schema is provided",
      result: { status: 200, data: { key: "test" } },
      schema: undefined,
    },
    {
      label: "no data is provided",
      result: { status: 204 },
      schema,
    },
    {
      label: "data is undefined",
      result: { status: 200, data: undefined },
      schema,
    },
    {
      label: "the data is successfully validated",
      result: { status: 200, data: { key: "test" } },
      schema,
    },
  ])(
    "returns result unchanged when $label",
    ({ result, schema: schemaProp }) => {
      expect(validateHandlerResponse(result, schemaProp)).toStrictEqual({
        result,
      });
    },
  );

  it("returns 500 with generic error message when data fails validation", () => {
    const validated = validateHandlerResponse(
      { status: 200, data: { key: "testing" } },
      schema,
    );

    expect(validated.errors).toStrictEqual([
      expect.objectContaining({ path: ["key"] }),
    ]);
    expect(validated.result).toStrictEqual({
      status: 500,
      error: "Internal server error",
    });
  });

  it("includes validation errors in response", () => {
    const result = {
      status: 200,
      data: { name: 123 },
    };

    const validated = validateHandlerResponse(result, schema, {
      showErrors: true,
    });

    expect(validated.errors).toBeDefined();
    expect(validated.result).toStrictEqual({
      status: 500,
      error: {
        message: "Failed handler response validation",
        errors: [expect.objectContaining({ path: ["key"], values: ["test"] })],
      },
    });
  });
});
