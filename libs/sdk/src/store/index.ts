import { AsyncLocalStorage } from "node:async_hooks";

export function createHandlerStore<T>(
  name: string,
): readonly [storage: AsyncLocalStorage<T>, get: () => T] {
  const storage = new AsyncLocalStorage<T>();

  return [
    storage,
    (): T => {
      const store = storage.getStore();
      if (!store) {
        throw new Error(
          `Store can only be accessed within a "${name}" handler`,
        );
      }
      return store;
    },
  ];
}
