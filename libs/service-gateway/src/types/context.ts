import type { Logger } from "@flex/logging";
import type {
  ExtractPathParams,
  HeaderConfig,
  Prettify,
  ReadonlyRecord,
} from "@flex/utils";
import type { z } from "zod";

import type { GatewayClientMap } from "./client";
import type { GatewayConfig, RouteKeyOf } from "./gateway";
import type { ResolvedResources } from "./resource";

type WithSchemaProperty<
  RouteConfig,
  Source extends string,
  Target extends string = Source,
> =
  RouteConfig extends Record<Source, infer Schema extends z.ZodType>
    ? { readonly [Key in Target]: z.output<Schema> }
    : unknown;

type ResolveHeaderValues<Headers extends ReadonlyRecord<string, HeaderConfig>> =
  {
    readonly [Key in keyof Headers]: Headers[Key] extends {
      readonly required: false;
    }
      ? string | undefined
      : string;
  };

type WithPathParams<Route extends string> = [ExtractPathParams<Route>] extends [
  never,
]
  ? unknown
  : {
      readonly pathParams: {
        readonly [Key in ExtractPathParams<Route>]: string;
      };
    };

type WithQueryParams<RouteConfig> = WithSchemaProperty<
  RouteConfig,
  "query",
  "queryParams"
>;

type WithHeaders<RouteConfig> = RouteConfig extends {
  readonly headers: infer Headers extends ReadonlyRecord<string, HeaderConfig>;
}
  ? keyof Headers extends never
    ? unknown
    : { readonly headers: ResolveHeaderValues<Headers> }
  : unknown;

type WithBody<RouteConfig> = WithSchemaProperty<RouteConfig, "body">;

export type GatewayOutboundData<RouteConfig> = RouteConfig extends {
  response: infer Schema extends z.ZodType;
}
  ? z.output<Schema>
  : unknown;

export interface GatewayContext {
  readonly logger: Logger;
  readonly clients: GatewayClientMap;
  readonly resources: ReadonlyRecord<string, unknown>;
  readonly pathParams?: ReadonlyRecord<string, string>;
  readonly queryParams?: ReadonlyRecord<string, unknown>;
  readonly headers?: ReadonlyRecord<string, string | undefined>;
  readonly body?: unknown;
}

export type GatewayHandlerContext<
  Config extends GatewayConfig,
  Route extends RouteKeyOf<Config>,
  Clients extends GatewayClientMap,
> = Prettify<
  {
    readonly logger: Logger;
    readonly clients: Clients;
    readonly resources: ResolvedResources<Config["resources"]>;
  } & WithPathParams<Route> &
    WithQueryParams<Config["routes"][Route]> &
    WithHeaders<Config["routes"][Route]> &
    WithBody<Config["routes"][Route]>
>;
