/* eslint-disable no-empty-pattern */
import { UserId } from "@flex/utils";
import { it as vitestIt, vi } from "vitest";

import {
  createAuthorizerEvent,
  createAuthorizerResult,
  createContext,
  createEvent,
  createEventWithAuthorizer,
  createMiddyRequest,
  createResponse,
} from "../fixtures";
import { createRestApiEvent } from "../fixtures/apigateway";
import type { HttpFixture } from "../fixtures/http";
import { createHttp } from "../fixtures/http";
import type { SdkFixture } from "../fixtures/sdk";
import { createSdkContext, createSdkEvent } from "../fixtures/sdk";
import { createUserId } from "../fixtures/user";

interface Fixtures {
  http: HttpFixture;
  sdk: SdkFixture;
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
  response: ReturnType<typeof createResponse>;
  userId: UserId;
}

export const it = vitestIt.extend<Fixtures>({
  http: [
    async ({}, use) => {
      using http = createHttp();
      await use(http);
    },
    { auto: true },
  ],
  sdk: async ({}, use) =>
    use({
      event: createSdkEvent(),
      context: createSdkContext(),
    }),
  authorizerEvent: async ({}, use) => use(createAuthorizerEvent()),
  authorizerResult: async ({}, use) => use(createAuthorizerResult()),
  context: async ({}, use) => use(createContext()),
  env: [
    async ({}, use) => {
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
  response: async ({}, use) => use(createResponse()),
  userId: async ({}, use) => use(createUserId()),
});
