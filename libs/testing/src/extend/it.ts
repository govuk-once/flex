/* eslint-disable no-empty-pattern */
import type { Mock } from "vitest";
import { it as vitestIt, vi } from "vitest";

import { ENV_DEFAULTS, SSM_DEFAULTS } from "../config";
import {
  createAuthorizerEvent,
  createAuthorizerResult,
  createContext,
  createEvent,
  createEventWithAuthorizer,
  createMiddyRequest,
  createResponse,
} from "../fixtures";
import {
  createRestApiEvent,
  createRestApiEventWithAuthorizer,
} from "../fixtures/apigateway";

interface Fixtures {
  authorizerEvent: ReturnType<typeof createAuthorizerEvent>;
  authorizerResult: ReturnType<typeof createAuthorizerResult>;
  context: ReturnType<typeof createContext>;
  env: {
    set: (env: Record<string, string | undefined>) => void;
    delete: (...keys: string[]) => void;
  };
  event: ReturnType<typeof createEvent>;
  eventWithAuthorizer: ReturnType<typeof createEventWithAuthorizer>;
  middy: ReturnType<typeof createMiddyRequest>;
  privateGatewayEvent: ReturnType<typeof createRestApiEvent>;
  privateGatewayEventWithAuthorizer: ReturnType<
    typeof createRestApiEventWithAuthorizer
  >;
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
  response: ReturnType<typeof createResponse>;
  ssm: {
    get: (path: string) => unknown;
    set: (params: Record<string, unknown>) => void;
    delete: (...paths: string[]) => void;
  };
}

export const it = vitestIt.extend<Fixtures>({
  authorizerEvent: async ({}, use) => use(createAuthorizerEvent()),
  authorizerResult: async ({}, use) => use(createAuthorizerResult()),
  context: async ({}, use) => use(createContext()),
  env: [
    async ({}, use) => {
      Object.entries(ENV_DEFAULTS).forEach(([k, v]) => {
        vi.stubEnv(k, v);
      });

      await use({
        set: (env) => {
          Object.entries(env).forEach(([k, v]) => {
            if (v) {
              vi.stubEnv(k, v);
            } else {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete process.env[k];
            }
          });
        },
        delete: (...keys) => {
          keys.forEach((k) => {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete process.env[k];
          });
        },
      });

      vi.unstubAllEnvs();
    },
    { auto: true },
  ],
  event: async ({}, use) => use(createEvent()),
  eventWithAuthorizer: async ({}, use) => use(createEventWithAuthorizer()),
  middy: async ({}, use) => use(createMiddyRequest()),
  privateGatewayEvent: async ({}, use) => use(createRestApiEvent()),
  privateGatewayEventWithAuthorizer: async ({}, use) =>
    use(createRestApiEventWithAuthorizer()),
  redis: [
    async ({}, use) => {
      const store = new Map<string, string>();

      const client: Fixtures["redis"]["client"] = {
        get: vi.fn((key) => Promise.resolve(store.get(key) ?? null)),
        set: vi.fn((key, value, _expirySeconds) => {
          store.set(key, value);
          return Promise.resolve("OK");
        }),
        del: vi.fn((key) => Promise.resolve(store.delete(key) ? 1 : 0)),
        disconnect: vi.fn(() => Promise.resolve()),
      };

      await use({ client, store });

      store.clear();
      Object.values(client).forEach((fn) => fn.mockClear());
    },
    { auto: true },
  ],
  response: async ({}, use) => use(createResponse()),
  ssm: [
    async ({}, use) => {
      const store = new Map<string, unknown>(Object.entries(SSM_DEFAULTS));

      await use({
        get: (path: string) => store.get(path),
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
