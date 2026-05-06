import { domain } from "@flex/sdk";

export const { config, route, routeContext } = domain({
  name: "perf",
  common: {
    access: "public",
    function: { timeoutSeconds: 10, memorySize: 128 },
  },
  resources: {},
  integrations: {},
  routes: {
    v1: {
      "/baseline": {
        GET: {
          public: {
            name: "perf-baseline",
            integrations: [],
          },
        },
      },
    },
  },
});
