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
      "/baseline-256mb": {
        GET: {
          public: {
            name: "perf-baseline-256mb",
            integrations: [],
            function: { memorySize: 256 },
          },
        },
      },
      "/baseline-512mb": {
        GET: {
          public: {
            name: "perf-baseline-512mb",
            integrations: [],
            function: { memorySize: 512 },
          },
        },
      },
      "/baseline-1024mb": {
        GET: {
          public: {
            name: "perf-baseline-1024mb",
            integrations: [],
            function: { memorySize: 1024 },
          },
        },
      },
      "/sdk-eager": {
        GET: {
          public: {
            name: "perf-sdk-eager",
            integrations: [],
          },
        },
      },
      "/sdk-eager-256mb": {
        GET: {
          public: {
            name: "perf-sdk-eager-256mb",
            integrations: [],
            function: { memorySize: 256 },
          },
        },
      },
      "/sdk-eager-512mb": {
        GET: {
          public: {
            name: "perf-sdk-eager-512mb",
            integrations: [],
            function: { memorySize: 512 },
          },
        },
      },
      "/sdk-lazy": {
        GET: {
          public: {
            name: "perf-sdk-lazy",
            integrations: [],
          },
        },
      },
    },
  },
});
