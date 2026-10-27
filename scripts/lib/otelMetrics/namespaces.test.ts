import { describe, expect, it } from "vitest";

import {
  ENRICHMENT_MODES,
  includeFiltersFor,
  namespacesFor,
  SCOPED_NAMESPACES,
  SUPPORTED_NAMESPACES,
} from "./namespaces";

describe("SUPPORTED_NAMESPACES", () => {
  it("has no duplicates", () => {
    expect(new Set(SUPPORTED_NAMESPACES).size).toBe(
      SUPPORTED_NAMESPACES.length,
    );
  });

  it("contains every scoped namespace", () => {
    expect(SUPPORTED_NAMESPACES).toEqual(
      expect.arrayContaining(SCOPED_NAMESPACES),
    );
  });
});

describe("includeFiltersFor", () => {
  it("selects Lambda and API Gateway in scoped mode", () => {
    expect(includeFiltersFor("scoped")).toEqual([
      { Namespace: "AWS/Lambda" },
      { Namespace: "AWS/ApiGateway" },
    ]);
  });

  it("sends no filters in all mode", () => {
    expect(includeFiltersFor("all")).toEqual([]);
  });
});

describe("namespacesFor", () => {
  it("returns the scoped namespaces in scoped mode", () => {
    expect(namespacesFor("scoped")).toEqual(["AWS/Lambda", "AWS/ApiGateway"]);
  });

  it("returns every supported namespace in all mode", () => {
    expect(namespacesFor("all")).toBe(SUPPORTED_NAMESPACES);
  });
});

describe("ENRICHMENT_MODES", () => {
  it("lists all and scoped", () => {
    expect(ENRICHMENT_MODES).toEqual(["all", "scoped"]);
  });
});
