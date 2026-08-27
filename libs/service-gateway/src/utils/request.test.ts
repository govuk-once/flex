import { it } from "@flex/testing";
import {
  resolveHeaders,
  resolvePathParams,
  resolveQueryParams,
  resolveRequestBody,
} from "@flex/utils";
import { testMatchedRoute, testRoutePath } from "@tests/fixtures";
import { beforeEach, describe, expect, vi } from "vitest";

import { parseRequest } from "./request";

vi.mock("@flex/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@flex/utils")>()),
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

  it("returns an empty object when all resolvers return undefined", ({
    platform,
  }) => {
    expect(
      parseRequest(platform.gatewayEvent.get(testRoutePath), testMatchedRoute),
    ).toStrictEqual({});
  });

  it("includes pathParams when the path parameters resolve to a value", ({
    platform,
  }) => {
    vi.mocked(resolvePathParams).mockReturnValue({ id: "123" });

    expect(
      parseRequest(platform.gatewayEvent.get(testRoutePath), testMatchedRoute),
    ).toStrictEqual({
      pathParams: { id: "123" },
    });
  });

  it("includes queryParams when the query parameters resolve to a value", ({
    platform,
  }) => {
    vi.mocked(resolveQueryParams).mockReturnValue({ key: "value" });

    expect(
      parseRequest(platform.gatewayEvent.get(testRoutePath), testMatchedRoute),
    ).toStrictEqual({
      queryParams: { key: "value" },
    });
  });

  it("includes headers when the headers resolve to a value", ({ platform }) => {
    vi.mocked(resolveHeaders).mockReturnValue({ auth: "token" });

    expect(
      parseRequest(platform.gatewayEvent.get(testRoutePath), testMatchedRoute),
    ).toStrictEqual({
      headers: { auth: "token" },
    });
  });

  it("includes the body even when it resolves to false", ({ platform }) => {
    vi.mocked(resolveRequestBody).mockReturnValue(false);

    expect(
      parseRequest(platform.gatewayEvent.get(testRoutePath), testMatchedRoute),
    ).toStrictEqual({
      body: false,
    });
  });

  it("omits the body when it resolves as undefined", ({ platform }) => {
    expect(
      parseRequest(platform.gatewayEvent.get(testRoutePath), testMatchedRoute),
    ).not.toHaveProperty("body");
  });

  it("returns the full request when all resolvers return a value", ({
    platform,
  }) => {
    vi.mocked(resolvePathParams).mockReturnValue({ id: "123" });
    vi.mocked(resolveQueryParams).mockReturnValue({ a: "a" });
    vi.mocked(resolveHeaders).mockReturnValue({ b: "b" });
    vi.mocked(resolveRequestBody).mockReturnValue({ c: "c" });

    expect(
      parseRequest(platform.gatewayEvent.get(testRoutePath), testMatchedRoute),
    ).toStrictEqual({
      pathParams: { id: "123" },
      queryParams: { a: "a" },
      headers: { b: "b" },
      body: { c: "c" },
    });
  });

  it("passes the correct event and route sources to each resolver", ({
    platform,
  }) => {
    const mockEvent = platform.gatewayEvent.get(testRoutePath);

    parseRequest(mockEvent, testMatchedRoute);

    expect(resolvePathParams).toHaveBeenCalledExactlyOnceWith(
      testMatchedRoute.params,
    );
    expect(resolveQueryParams).toHaveBeenCalledExactlyOnceWith(
      mockEvent.queryStringParameters,
      testMatchedRoute.config.query,
    );
    expect(resolveHeaders).toHaveBeenCalledExactlyOnceWith(
      mockEvent.headers,
      testMatchedRoute.config.headers,
    );
    expect(resolveRequestBody).toHaveBeenCalledExactlyOnceWith(
      mockEvent.body,
      testMatchedRoute.config.body,
    );
  });
});
