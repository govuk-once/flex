import { domain } from "@flex/sdk";
import { z } from "zod";

const GreetingResponseSchema = z.object({
  message: z.literal("Mike is the best!"),
  topicCount: z.number().optional(),
});

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
