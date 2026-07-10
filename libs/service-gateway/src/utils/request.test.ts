import {
  resolveHeaders,
  resolvePathParams,
  resolveQueryParams,
  resolveRequestBody,
} from "@flex/utils";
import { gatewayEvent, matchedRoute } from "@tests/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseRequest } from "./request";

vi.mock("@flex/utils", () => ({
  resolvePathParams: vi.fn(),
  resolveQueryParams: vi.fn(),
  resolveHeaders: vi.fn(),
  resolveRequestBody: vi.fn(),
}));

describe("parseRequest", () => {
  beforeEach(() => {
    vi.mocked(resolvePathParams).mockReturnValue(undefined);
    vi.mocked(resolveQueryParams).mockReturnValue(undefined);
    vi.mocked(resolveHeaders).mockReturnValue(undefined);
    vi.mocked(resolveRequestBody).mockReturnValue(undefined);
  });

  it("returns an empty object when all resolvers return undefined", () => {
    expect(parseRequest(gatewayEvent, matchedRoute)).toStrictEqual({});
  });

  it("includes pathParams when the path parameters resolve to a value", () => {
    vi.mocked(resolvePathParams).mockReturnValue({ id: "123" });

    expect(parseRequest(gatewayEvent, matchedRoute)).toStrictEqual({
      pathParams: { id: "123" },
    });
  });

  it("includes queryParams when the query parameters resolve to a value", () => {
    vi.mocked(resolveQueryParams).mockReturnValue({ key: "value" });

    expect(parseRequest(gatewayEvent, matchedRoute)).toStrictEqual({
      queryParams: { key: "value" },
    });
  });

  it("includes headers when the headers resolve to a value", () => {
    vi.mocked(resolveHeaders).mockReturnValue({ auth: "token" });

    expect(parseRequest(gatewayEvent, matchedRoute)).toStrictEqual({
      headers: { auth: "token" },
    });
  });

  it("includes the body even when it resolves to false", () => {
    vi.mocked(resolveRequestBody).mockReturnValue(false);

    expect(parseRequest(gatewayEvent, matchedRoute)).toStrictEqual({
      body: false,
    });
  });

  it("omits the body when it resolves as undefined", () => {
    expect(parseRequest(gatewayEvent, matchedRoute)).not.toHaveProperty("body");
  });

  it("returns the full request when all resolvers return a value", () => {
    vi.mocked(resolvePathParams).mockReturnValue({ id: "123" });
    vi.mocked(resolveQueryParams).mockReturnValue({ a: "a" });
    vi.mocked(resolveHeaders).mockReturnValue({ b: "b" });
    vi.mocked(resolveRequestBody).mockReturnValue({ c: "c" });

    expect(parseRequest(gatewayEvent, matchedRoute)).toStrictEqual({
      pathParams: { id: "123" },
      queryParams: { a: "a" },
      headers: { b: "b" },
      body: { c: "c" },
    });
  });

  it("passes the correct event and route sources to each resolver", () => {
    parseRequest(gatewayEvent, matchedRoute);

    expect(resolvePathParams).toHaveBeenCalledExactlyOnceWith(
      matchedRoute.params,
    );
    expect(resolveQueryParams).toHaveBeenCalledExactlyOnceWith(
      gatewayEvent.queryStringParameters,
      matchedRoute.config.query,
    );
    expect(resolveHeaders).toHaveBeenCalledExactlyOnceWith(
      gatewayEvent.headers,
      matchedRoute.config.headers,
    );
    expect(resolveRequestBody).toHaveBeenCalledExactlyOnceWith(
      gatewayEvent.body,
      matchedRoute.config.body,
    );
  });
});
