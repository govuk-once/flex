import type { ApiResult } from "@flex/flex-fetch";
import type { Logger } from "@flex/logging";
import type { Environment, QueryParams } from "@flex/utils";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import type z from "zod";

import type { ExtractPathParams, HeaderConfig, HttpMethod } from "../types";

// Helpers

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

type HeaderMap = Record<string, string | undefined>;

// Downstream

export type DownstreamResult<T = unknown> = ApiResult<T>;

export interface DownstreamRefCommon {
  path: string;
  env: string;
  scope?: "environment" | "stage";
}

interface DownstreamSecretRef<
  T extends z.ZodType = z.ZodType,
> extends DownstreamRefCommon {
  type: "secret";
  config?: T;
}

interface DownstreamSsmRef extends DownstreamRefCommon {
  type: "ssm";
}

export type RemoteApiAuth =
  | { type: "public" }
  | { type: "sigv4"; roleName: string };

export interface RemoteApiDownstream<T extends z.ZodType = z.ZodType> {
  type: "remote-api";
  ref: DownstreamSecretRef<T>;
  auth: RemoteApiAuth;
}

export interface EventBusDownstream {
  type: "event-bus";
  ref: DownstreamSsmRef;
}

export type GatewayDownstream = RemoteApiDownstream | EventBusDownstream;

type DownstreamSecretConfig<Config extends GatewayConfig> =
  Config["downstream"] extends RemoteApiDownstream<infer Schema>
    ? z.output<Schema>
    : never;

// Gateway Config

export type RouteKey = `${HttpMethod} /${string}`;

export interface GatewayRoute {
  name: string;
  query?: z.ZodType;
  headers?: Readonly<Record<string, HeaderConfig>>;
  body?: z.ZodType;
}

export type GatewayRoutes = Readonly<Record<RouteKey, GatewayRoute>>;

export interface GatewayConfig<
  Downstream extends GatewayDownstream = GatewayDownstream,
  Routes extends GatewayRoutes = GatewayRoutes,
> {
  name: string;
  environments: readonly Environment[];
  downstream: Downstream;
  policy?: unknown; // TODO
  routes: Routes;
}

export type GatewayLambda = (
  event: APIGatewayProxyEvent,
  context: Context,
) => Promise<APIGatewayProxyResultV2>;

// Handler Context

type WithPathParams<Route extends string> = [ExtractPathParams<Route>] extends [
  never,
]
  ? unknown
  : {
      readonly pathParams: {
        readonly [Key in ExtractPathParams<Route>]: string;
      };
    };

type WithQueryParams<RouteConfig> = RouteConfig extends {
  readonly query: z.ZodType<infer QueryParams>;
}
  ? { readonly queryParams: QueryParams }
  : unknown;

type WithHeaders<RouteConfig> = RouteConfig extends {
  readonly headers: infer Headers extends Readonly<
    Record<string, HeaderConfig>
  >;
}
  ? keyof Headers extends never
    ? unknown
    : {
        readonly headers: {
          readonly [Key in keyof Headers]: Headers[Key] extends {
            readonly required: false;
          }
            ? string | undefined
            : string;
        };
      }
  : unknown;

type WithBody<RouteConfig> = RouteConfig extends {
  readonly body: z.ZodType<infer Body>;
}
  ? { readonly body: Body }
  : unknown;

export type GatewayHandlerContext<
  Config extends GatewayConfig,
  Route extends keyof Config["routes"] & string,
> = {
  readonly logger: Logger;
  readonly client: DownstreamClient<Config>;
} & WithPathParams<Route> &
  WithQueryParams<Config["routes"][Route]> &
  WithHeaders<Config["routes"][Route]> &
  WithBody<Config["routes"][Route]>;

export type GatewayHandlerMap<Config extends GatewayConfig> = {
  [Route in keyof Config["routes"] & string]: (
    context: GatewayHandlerContext<Config, Route>,
  ) => Promise<DownstreamResult>;
};

export interface GatewayStore {
  readonly logger: Logger;
  readonly client: GatewayClient;
  readonly pathParams?: Readonly<Record<string, string>>;
  readonly queryParams?: Readonly<Record<string, unknown>>;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly body?: unknown;
}

export type GatewayHandler = (
  context: GatewayStore,
) => Promise<DownstreamResult>;

// Gateway

export interface Gateway<Config extends GatewayConfig> {
  readonly config: Config;
  readonly createHandler: (
    handlers: GatewayHandlerMap<Config>,
  ) => GatewayLambda;
}

// Client

export type RemoteApiRequest<Body extends Json = Json> =
  | {
      method: "GET" | "DELETE";
      path: string;
      query?: QueryParams;
      headers?: HeaderMap;
    }
  | {
      method: "POST" | "PUT" | "PATCH";
      path: string;
      body?: Body;
      query?: QueryParams;
      headers?: HeaderMap;
    };

interface RemoteApiClient<Config = unknown> {
  readonly config: Config;
  request<Out, In extends Json = Json>(
    input: RemoteApiRequest<In>,
  ): Promise<DownstreamResult<Out>>;
}

// TODO
export interface EventBusRequest<T = unknown> {
  todo: T;
}

// TODO
interface EventBusClient<Config = unknown> {
  readonly config: Config;
  request<Out, In>(input: EventBusRequest<In>): Promise<DownstreamResult<Out>>;
}

export type GatewayClient = RemoteApiClient | EventBusClient;

export type DownstreamClient<Config extends GatewayConfig> =
  Config["downstream"] extends RemoteApiDownstream
    ? RemoteApiClient<DownstreamSecretConfig<Config>>
    : Config["downstream"] extends EventBusDownstream
      ? EventBusClient<DownstreamSsmRef>
      : never;
