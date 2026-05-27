import { describe, expect, it } from "vitest";
import { z } from "zod";

import { typedFetch } from "./typed-fetch";

function makeResponse(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("typedFetch", () => {
  it("returns ok result with parsed data when response is successful and schema is provided", async () => {
    const schema = z.object({ id: z.number() });
    const result = await typedFetch(makeResponse(200, { id: 42 }), schema);

    expect(result).toEqual({ ok: true, status: 200, data: { id: 42 } });
  });

  it("returns ok result with raw body when no schema is provided", async () => {
    const result = await typedFetch(makeResponse(200, { value: "hello" }));

    expect(result).toEqual({ ok: true, status: 200, data: { value: "hello" } });
  });

  it("returns error result when response is not ok", async () => {
    const result = await typedFetch(
      makeResponse(404, { message: "Not found" }),
    );

    expect(result).toEqual({
      ok: false,
      error: {
        status: 404,
        message: "Not found",
        body: { message: "Not found" },
      },
    });
  });

  it("returns error result when response body fails schema validation", async () => {
    const schema = z.object({ id: z.number() });
    const result = await typedFetch(
      makeResponse(200, { id: "not-a-number" }),
      schema,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { status: 422, message: "Response validation failed" },
    });
  });

  it("uses statusText as message when error response has no message field", async () => {
    const result = await typedFetch(
      Promise.resolve(
        new Response(JSON.stringify({ detail: "gone" }), {
          status: 410,
          statusText: "Gone",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    expect(result).toMatchObject({
      ok: false,
      error: { status: 410, message: "Gone" },
    });
  });
});
