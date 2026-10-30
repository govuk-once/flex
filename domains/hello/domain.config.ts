import { domain } from "@flex/sdk";

import { GetHelloResponseSchema } from "./src/schemas";

export const { config, route, routeContext } = domain({
  name: "hello",
  environments: ["development"],
  common: {
    access: "public",
    function: { timeoutSeconds: 20 },
  },
  resources: {},
  integrations: {},
  routes: {
    v1: {
      "/hello": {
        GET: {
          public: {
            name: "say-hello",
            response: GetHelloResponseSchema,
          },
        },
      },
    },
  },
});
