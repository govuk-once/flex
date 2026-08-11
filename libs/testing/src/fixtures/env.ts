import { vi } from "vitest";

function deleteKey(key: string) {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete process.env[key];
}

export interface EnvFixture {
  set: (env: Record<string, string | undefined>) => void;
  delete: (...keys: string[]) => void;
}

export function createEnv(): EnvFixture {
  return {
    set: (env) => {
      Object.entries(env).forEach(([k, v]) => {
        if (v) {
          vi.stubEnv(k, v);
        } else {
          deleteKey(k);
        }
      });
    },
    delete: (...keys) => {
      keys.forEach(deleteKey);
    },
  };
}
