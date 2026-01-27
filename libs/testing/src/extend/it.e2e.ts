import { inject, it as vitestIt } from "vitest";

import { createApi } from "../fixtures";

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
