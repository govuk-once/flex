import { domain } from "@flex/sdk";
import { z } from "zod";

const ItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const { config, route, routeContext } = domain({
  name: "valid-domain",
  common: {
    access: "isolated",
    function: { timeoutSeconds: 30 },
  },
  routes: {
    v1: {
      "/items": {
        GET: {
          public: {
            name: "get-items",
            response: z.array(ItemSchema),
          },
        },
        POST: {
          private: {
            name: "create-item",
            body: ItemSchema,
          },
        },
      },
      "/items/:id": {
        GET: {
          public: {
            name: "get-item",
            response: ItemSchema,
          },
        },
        DELETE: {
          public: {
            name: "delete-item",
          },
        },
      },
    },
  },
});
