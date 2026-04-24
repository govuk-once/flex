import { inject, it as vitestIt } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    e2eEnv: E2EEnv;
  }
}

import { E2EEnv } from "../config/env";
import { createApi } from "../fixtures";

interface Fixtures {
  cloudfront: ReturnType<typeof createApi>;
  privateGateway: ReturnType<typeof createApi>;
}

export const extendIt = () =>
  vitestIt.extend<Fixtures>({
    cloudfront: async ({ signal }, use) => {
      const { FLEX_API_URL } = inject("e2eEnv");
      await use(createApi(`${FLEX_API_URL}/app`, { signal }));
    },
    privateGateway: async ({ signal }, use) => {
      const { FLEX_PRIVATE_GATEWAY_URL } = inject("e2eEnv");
      await use(createApi(FLEX_PRIVATE_GATEWAY_URL, { signal }));
    },
  });
