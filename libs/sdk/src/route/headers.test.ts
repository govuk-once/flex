import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import type { HeaderConfig } from "../types";
import { mergeHeaders, resolveHeaders } from "./headers";

describe("mergeHeaders", () => {
  it.for<{
    label: string;
    common?: Record<string, HeaderConfig>;
    route?: Record<string, HeaderConfig>;
    expected?: Record<string, HeaderConfig>;
  }>([
    {
      label: "common and route headers are undefined",
      common: undefined,
      route: undefined,
      expected: undefined,
    },
    {
      label: "common and route headers are empty",
      common: {},
      route: {},
      expected: undefined,
    },
    {
      label: "only common headers exist",
      common: { test: { name: "x-common" } },
      route: undefined,
      expected: { test: { name: "x-common" } },
    },
    {
      label: "only route headers exist",
      common: undefined,
      route: { test: { name: "x-route" } },
      expected: { test: { name: "x-route" } },
    },
    {
      label: "common and route headers contain header key conflicts",
      common: {
        common: { name: "x-common" },
        test: { name: "x-shared", required: true },
      },
      route: {
        route: { name: "x-route" },
        test: { name: "x-shared", required: false },
      },
      expected: {
        common: { name: "x-common" },
        route: { name: "x-route" },
        test: { name: "x-shared", required: false },
      },
    },
  ])("returns expected result when $label", ({ common, route, expected }) => {
    expect(mergeHeaders(common, route)).toStrictEqual(expected);
  });
});

describe("resolveHeaders", () => {
  it("resolves headers from the event", () => {
    expect(
      resolveHeaders({ header: { name: "x-test" } }, { "x-test": "abc-123" }),
    ).toStrictEqual({ header: "abc-123" });
  });

  it("sets optional headers to undefined when missing from the event", () => {
    expect(
      resolveHeaders({ header: { name: "x-test", required: false } }, {}),
    ).toStrictEqual({ header: undefined });
  });

  it("resolves optional headers to undefined when event headers are not provided", () => {
    expect(
      resolveHeaders(
        { header: { name: "x-test", required: false } },
        undefined,
      ),
    ).toStrictEqual({ header: undefined });
  });

  it.for<{
    label: string;
    routeHeaders: Record<string, HeaderConfig>;
    eventHeaders?: Record<string, string>;
    expected: string[];
  }>([
    {
      label: "single required header missing",
      routeHeaders: { test: { name: "x-test" } },
      eventHeaders: {},
      expected: ["x-test"],
    },
    {
      label: "multiple required headers missing",
      routeHeaders: {
        test: { name: "x-test" },
        required: { name: "x-required", required: true },
        optional: { name: "x-optional", required: false },
      },
      eventHeaders: {},
      expected: ["x-test", "x-required"],
    },
    {
      label: "event headers are undefined",
      routeHeaders: { test: { name: "x-test" } },
      eventHeaders: undefined,
      expected: ["x-test"],
    },
  ])(
    "throws and lists missing headers when $label",
    ({ routeHeaders, eventHeaders, expected }) => {
      expect(() => resolveHeaders(routeHeaders, eventHeaders)).toThrow(
        `Missing headers: ${expected.join(", ")}`,
      );
    },
  );
});
