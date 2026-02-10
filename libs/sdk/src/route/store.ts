import { AsyncLocalStorage } from "node:async_hooks";

import type { Logger } from "@flex/logging";

import type { RouteAuth } from "../types";

export interface RouteStore {
  readonly logger: Logger;
  readonly auth?: Readonly<RouteAuth>;
  readonly body?: unknown;
  readonly pathParams?: Readonly<Record<string, string>>;
  readonly queryParams?: Readonly<Record<string, unknown>>;
  readonly resources?: Readonly<Record<string, string>>;
  readonly headers?: Readonly<Record<string, string | undefined>>;
}

export const routeStorage = new AsyncLocalStorage<RouteStore>();

export function getRouteStore(): RouteStore {
  const store = routeStorage.getStore();

  if (!store) {
    throw new Error(
      "Route store is not available. Must be called within a route handler",
    );
  }

  return store;
}
