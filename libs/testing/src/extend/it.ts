/* eslint-disable no-empty-pattern */
import type { Mock } from "vitest";
import { it as vitestIt, vi } from "vitest";

import { ENV_DEFAULTS, SSM_DEFAULTS } from "../config";
import { createContext, createEvent } from "../fixtures";

interface Fixtures {
  context: ReturnType<typeof createContext>;
  env: {
    set: (env: Record<string, string | undefined>) => void;
    delete: (...keys: string[]) => void;
  };
  event: ReturnType<typeof createEvent>;
  redis: {
    client: {
      get: Mock<(key: string) => Promise<string | null>>;
      set: Mock<
        (
          key: string,
          value: string,
          expirySeconds?: number,
        ) => Promise<"OK" | null>
      >;
      del: Mock<(key: string) => Promise<number>>;
      disconnect: Mock<() => Promise<void>>;
    };
    store: Map<string, string>;
  };
  ssm: {
    get: <T = string | undefined>(path: string) => T;
    set: (params: Record<string, unknown>) => void;
    delete: (...paths: string[]) => void;
  };
}

export const it = vitestIt.extend<Fixtures>({
  context: async ({}, use) => use(createContext()),
  env: [
    async ({}, use) => {
      const original = { ...process.env };
      const store = new Set<string>();

      const set: Fixtures["env"]["set"] = (env) => {
        Object.entries(env).forEach(([k, v]) => {
          process.env[k] = v;
          store.add(k);
        });
      };

      set(ENV_DEFAULTS);

      await use({
        set,
        delete: (...keys) => {
          keys.forEach((k) => {
            delete process.env[k];
            store.delete(k);
          });
        },
      });

      store.forEach((k) => delete process.env[k]);
      Object.assign(process.env, original);
    },
    { auto: true },
  ],
  event: async ({}, use) => use(createEvent()),
  redis: [
    async ({}, use) => {
      const store = new Map<string, string>();

      const client: Fixtures["redis"]["client"] = {
        get: vi.fn((key) => Promise.resolve(store.get(key) ?? null)),
        set: vi.fn(
          (key, value, _expirySeconds) =>
            store.set(key, value) && Promise.resolve("OK"),
        ),
        del: vi.fn((key) => Promise.resolve(store.delete(key) ? 1 : 0)),
        disconnect: vi.fn(() => Promise.resolve()),
      };

      await use({ client, store });

      store.clear();
      Object.values(client).forEach((fn) => fn.mockClear());
    },
    { auto: true },
  ],
  ssm: [
    async ({}, use) => {
      const store = new Map<string, unknown>(Object.entries(SSM_DEFAULTS));

      await use({
        get: <T>(path: string) => store.get(path) as T,
        set: (params) => {
          Object.entries(params).forEach(([path, value]) => {
            store.set(path, value);
          });
        },
        delete: (...paths) => {
          paths.forEach((path) => store.delete(path));
        },
      });

      store.clear();
    },
    { auto: true },
  ],
});
