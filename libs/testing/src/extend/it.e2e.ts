import { inject, it as vitestIt } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    e2eEnv: E2EEnv;
  }
}

import { createApi } from "../fixtures";
import { E2EEnv } from "../index.e2e";

interface Fixtures {
  cloudfront: ReturnType<typeof createApi>;
}

export const it = vitestIt.extend<Fixtures>({
  cloudfront: async ({ signal }, use) => {
    const { CLOUDFRONT_DISTRIBUTION_URL } = inject("e2eEnv");
    await use(createApi(`${CLOUDFRONT_DISTRIBUTION_URL}/app`, { signal }));
  },
});
