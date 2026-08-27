import { inject, it as vitestIt } from "vitest";

import { E2EEnv } from "../config/env";
import { createApi } from "../fixtures/api";

declare module "vitest" {
  export interface ProvidedContext {
    e2eEnv: E2EEnv;
  }
}

const E2E_BYPASS_HEADER = "x-flex-e2e-bypass";

interface Fixtures {
  cloudfront: ReturnType<typeof createApi>;
  docs: ReturnType<typeof createApi>;
  privateGateway: ReturnType<typeof createApi>;
  authHeader: { Authorization: string; [E2E_BYPASS_HEADER]: string };
}

export const extendIt = () =>
  vitestIt.extend<Fixtures>({
    cloudfront: async ({ signal }, use) => {
      const { FLEX_API_URL } = inject("e2eEnv");
      await use(createApi(`${FLEX_API_URL}/app`, { signal }));
    },
    docs: async ({ signal }, use) => {
      const { FLEX_API_URL } = inject("e2eEnv");
      await use(createApi(FLEX_API_URL, { signal }));
    },
    privateGateway: async ({ signal }, use) => {
      const { FLEX_PRIVATE_GATEWAY_URL } = inject("e2eEnv");
      await use(createApi(FLEX_PRIVATE_GATEWAY_URL, { signal }));
    },
    // eslint-disable-next-line no-empty-pattern
    authHeader: async ({}, use) => {
      const { JWT, E2E_BYPASS_TOKEN } = inject("e2eEnv");
      await use({
        Authorization: `Bearer ${JWT.VALID}`,
        [E2E_BYPASS_HEADER]: E2E_BYPASS_TOKEN,
      });
    },
  });
