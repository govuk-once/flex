import { describe, expect, it } from "vitest";

import { buildRequest, parseResponseBody } from "./request";

describe("buildRequest", () => {
  const url = new URL("https://example.com/api");

  it("sets method and default Content-Type header", () => {
    const req = buildRequest(url, "GET");
    expect(req.method).toBe("GET");
    expect(req.headers.get("Content-Type")).toBe("application/json");
  });

  it("merges custom headers with default Content-Type", () => {
    const req = buildRequest(url, "POST", {
      headers: { Authorization: "Bearer token" },
    });
    expect(req.headers.get("Authorization")).toBe("Bearer token");
    expect(req.headers.get("Content-Type")).toBe("application/json");
  });

  it("stringifies body when provided", async () => {
    const req = buildRequest(url, "POST", { body: { foo: "bar" } });
    expect(await req.text()).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("omits body when not provided", async () => {
    const req = buildRequest(url, "GET");
    expect(await req.text()).toBe("");
  });

  it("omits body when null is passed", async () => {
    const req = buildRequest(url, "DELETE", { body: null });
    expect(await req.text()).toBe("");
  });
});

describe("parseResponseBody", () => {
  function makeResponse(
    body: string,
    status: number,
    headers: Record<string, string> = {},
  ) {
    return new Response(body, { status, headers });
  }

  it("returns undefined for 204 responses", async () => {
    const result = await parseResponseBody(new Response(null, { status: 204 }));
    expect(result).toBeUndefined();
  });

  it("returns undefined when Content-Length is 0", async () => {
    const result = await parseResponseBody(
      makeResponse("", 200, { "Content-Length": "0" }),
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined when body text is empty", async () => {
    const result = await parseResponseBody(makeResponse("", 200));
    expect(result).toBeUndefined();
  });

  it("parses JSON body when content-type is application/json", async () => {
    const result = await parseResponseBody(
      makeResponse(JSON.stringify({ id: 1 }), 200, {
        "Content-Type": "application/json",
      }),
    );
    expect(result).toEqual({ id: 1 });
  });

  it("returns raw text when JSON parsing fails", async () => {
    const result = await parseResponseBody(
      makeResponse("not-json{", 200, { "Content-Type": "application/json" }),
    );
    expect(result).toBe("not-json{");
  });

  it("returns raw text for non-JSON content types", async () => {
    const result = await parseResponseBody(
      makeResponse("plain text", 200, { "Content-Type": "text/plain" }),
    );
    expect(result).toBe("plain text");
  });
});
