import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import type { RouteStore } from "./store";
import { getRouteStore, routeStorage } from "./store";

describe("getRouteStore", () => {
  const store: RouteStore = { logger: {} } as RouteStore;

  it("returns the store when called within a route handler context", () => {
    routeStorage.run(store, () => {
      expect(getRouteStore()).toBe(store);
    });
  });

  it("throws when called outside of a route handler context", () => {
    expect(() => getRouteStore()).toThrow(
      "Route store is not available. Must be called within a route handler",
    );
  });
});
