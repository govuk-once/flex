import { inject, it as vitestIt } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    e2eEnv: E2EEnv;
  }
}

import { createApi } from "../fixtures";
import { E2EEnv } from "../index.e2e";

interface Fixtures {
  api: ReturnType<typeof createApi>;
  cloudfront: ReturnType<typeof createApi>;
}

export const it = vitestIt.extend<Fixtures>({
  api: async ({ signal }, use) => {
    const { API_GATEWAY_URL } = inject("e2eEnv");
    await use(createApi(API_GATEWAY_URL, { signal }));
  },
  cloudfront: async ({ signal }, use) => {
    const { CLOUDFRONT_DISTRIBUTION_URL } = inject("e2eEnv");
    await use(createApi(CLOUDFRONT_DISTRIBUTION_URL, { signal }));
  },
});
