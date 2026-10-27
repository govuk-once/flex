import { domain } from "@flex/sdk";
import { z } from "zod";

const GreetingResponseSchema = z.object({
  message: "Mike is the best!",
  topicCount: z.number().optional(),
});

// The SDK's domain type is unresolved here, so keep its inferred exports while
// suppressing the resulting unsafe-call and unsafe-assignment lint reports.
export const { config, route, routeContext } = domain({
  name: "xtreme-awesome",
  environments: ["development"],
  common: { access: "isolated" },
  routes: {
    v1: {
      "/whoisthebest": {
        GET: {
          public: {
            name: "thebest",
            response: GreetingResponseSchema,
          },
        },
      },
    },
  },
});
