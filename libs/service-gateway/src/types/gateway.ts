import type {
  Environment,
  HeaderConfig,
  HttpMethod,
  ReadonlyRecord,
  RouteAccess,
} from "@flex/utils";
import type { z } from "zod";

import type { ResourceMap } from "./resource";

export type RouteKey = `${HttpMethod} /${string}`;

export type RouteKeyOf<Config extends GatewayConfig> = keyof Config["routes"] &
  string;

export interface GatewayFunctionConfig {
  readonly enableDefaultAlarms?: boolean;
}

export interface GatewayRoute {
  readonly name: string;
  readonly query?: z.ZodType;
  readonly headers?: ReadonlyRecord<string, HeaderConfig>;
  readonly body?: z.ZodType;
  readonly response?: z.ZodType;
}

export type GatewayRouteMap = ReadonlyRecord<RouteKey, GatewayRoute>;

export interface GatewayConfig {
  readonly name: string;
  readonly environments: readonly Environment[];
  readonly access: RouteAccess;
  readonly resources: ResourceMap;
  readonly function?: GatewayFunctionConfig;
  readonly policy?: unknown;
  readonly routes: GatewayRouteMap;
}
