import { AsyncLocalStorage } from "node:async_hooks";

import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { createHandlerStore } from ".";

describe("createHandlerStore", () => {
  const store = { key: "value" };
  const name = "test-store";

  it("returns a storage instance and a getter", () => {
    const [storage, get] = createHandlerStore(name);

    expect(storage).toBeInstanceOf(AsyncLocalStorage);
    expect(get).toBeTypeOf("function");
  });

  it("returns the store within an active scope", () => {
    const [storage, get] = createHandlerStore(name);

    expect(storage.run(store, get)).toBe(store);
  });

  it("throws when the store is accessed outside any scope", () => {
    const [, get] = createHandlerStore(name);

    expect(() => get()).toThrow(
      `Store can only be accessed within a "${name}" handler`,
    );
  });

  it("throws when accessing a store from a different store's active scope", () => {
    const [storageA, getA] = createHandlerStore("a");
    const [, getB] = createHandlerStore("b");

    const result = storageA.run({ v: "A" }, () => {
      expect(() => getB()).toThrow();
      return getA();
    });

    expect(result).toStrictEqual({ v: "A" });
  });
});
