// Type-level assertions, checked by `tsc --noEmit`. Vitest does not run this file.
import { expectTypeOf } from "vitest";

import type { InferRouteContext, RouteAuth } from "../types";

type Config = {
  readonly name: "test";
  readonly common: { readonly access: "isolated" };
  readonly routes: {
    readonly v1: {
      readonly "/items": {
        readonly GET: {
          readonly public: { readonly name: "list-items" };
          readonly private: { readonly name: "list-items-internally" };
        };
        readonly POST: {
          readonly public: {
            readonly name: "create-item";
            readonly access: "public";
          };
          readonly private: {
            readonly name: "create-item-internally";
            readonly access: "private";
          };
        };
      };
    };
  };
};

// `auth` follows the gateway a route is on, not its network access.
expectTypeOf<InferRouteContext<Config, "GET /v1/items">>().toHaveProperty(
  "auth",
);
expectTypeOf<
  InferRouteContext<Config, "GET /v1/items">["auth"]
>().toEqualTypeOf<RouteAuth>();
expectTypeOf<InferRouteContext<Config, "POST /v1/items">>().toHaveProperty(
  "auth",
);
expectTypeOf<
  InferRouteContext<Config, "POST /v1/items">["auth"]
>().toEqualTypeOf<RouteAuth>();

expectTypeOf<
  InferRouteContext<Config, "GET /v1/items [private]">
>().not.toHaveProperty("auth");
expectTypeOf<
  InferRouteContext<Config, "POST /v1/items [private]">
>().not.toHaveProperty("auth");
