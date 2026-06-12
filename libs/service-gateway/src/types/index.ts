import type { ApiResult } from "@flex/flex-fetch";
import type { Logger } from "@flex/logging";
import type {
  Environment,
  ExtractPathParams,
  HeaderConfig,
  HttpMethod,
  Json,
  QueryParams,
  RouteAccess,
} from "@flex/utils";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import type z from "zod";

import { GatewayConfigSchema } from "../schemas";

// Helpers

type HeaderMap = Record<string, string | undefined>;

export type IacGatewayConfig = z.infer<typeof GatewayConfigSchema>;

// Resources

export type GatewayResourceType = "secret" | "kms" | "role" | "ssm";

export interface GatewayResource<Config extends z.ZodType = z.ZodType> {
  type: GatewayResourceType;
  path: string;
  env?: string;
  scope?: "environment" | "stage";
  config?: Config;
}

export type GatewayResources = Readonly<Record<string, GatewayResource>>;

// Downstream

export type DownstreamResult<T = unknown> = ApiResult<T>;

export type RemoteApiAuth =
  | { type: "public" }
  | { type: "sigv4"; roleName: string; role: string };

export interface RemoteApiDownstream {
  type: "remote-api";
  ref: string;
  auth: RemoteApiAuth;
}

export interface EventBusDownstream {
  type: "event-bus";
  ref: string;
  auth: RemoteApiAuth;
}

export type GatewayDownstream = RemoteApiDownstream | EventBusDownstream;

// Gateway config

export type RouteKey = `${HttpMethod} /${string}`;

export interface GatewayRoute {
  name: string;
  query?: z.ZodType;
  headers?: Readonly<Record<string, HeaderConfig>>;
  body?: z.ZodType;
}

export type GatewayRoutes = Readonly<Record<RouteKey, GatewayRoute>>;

export interface GatewayConfig {
  name: string;
  environments: readonly Environment[];
  access?: RouteAccess;
  resources?: GatewayResources;
  downstream: GatewayDownstream;
  policy?: unknown; // TODO
  routes: GatewayRoutes;
}

export type ResourceKeysOfType<
  Resources extends GatewayResources,
  Type extends GatewayResourceType,
> = {
  [Key in keyof Resources]: Resources[Key] extends { type: Type } ? Key : never;
}[keyof Resources] &
  string;

type GatewayInputAuth<Resources extends GatewayResources> =
  | { type: "public" }
  | {
      type: "sigv4";
      roleName: string;
      role: ResourceKeysOfType<Resources, "role">;
    };

interface RemoteApiDownstreamInput<Resources extends GatewayResources> {
  type: "remote-api";
  ref: ResourceKeysOfType<Resources, "secret">;
  auth: GatewayInputAuth<Resources>;
}

interface EventBusDownstreamInput<Resources extends GatewayResources> {
  type: "event-bus";
  ref: ResourceKeysOfType<Resources, "ssm">;
  auth: GatewayInputAuth<Resources>;
}

type GatewayDownstreamInput<Resources extends GatewayResources> =
  | RemoteApiDownstreamInput<Resources>
  | EventBusDownstreamInput<Resources>;

export interface GatewayConfigInput<
  Resources extends GatewayResources = GatewayResources,
> {
  name: string;
  environments: readonly Environment[];
  access?: RouteAccess;
  resources?: Resources;
  downstream: GatewayDownstreamInput<NoInfer<Resources>>;
  policy?: unknown;
  routes: GatewayRoutes;
}

export type InferResources<Config> = Config extends {
  resources: infer Resources extends GatewayResources;
}
  ? Resources
  : Record<never, never>;

// Downstream client config

type SecretRefKey<Config> = Config extends {
  downstream: { type: "remote-api"; ref: infer Key extends string };
}
  ? Key
  : never;

type DownstreamSecretConfig<Config extends GatewayConfig> =
  SecretRefKey<Config> extends keyof InferResources<Config>
    ? InferResources<Config>[SecretRefKey<Config>] extends {
        config: infer Schema extends z.ZodType;
      }
      ? z.output<Schema>
      : never
    : never;

export type GatewayLambda = (
  event: APIGatewayProxyEvent,
  context: Context,
) => Promise<APIGatewayProxyResultV2>;

// Handler context

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
  Config["downstream"] extends { type: "remote-api" }
    ? RemoteApiClient<DownstreamSecretConfig<Config>>
    : Config["downstream"] extends { type: "event-bus" }
      ? EventBusClient
      : never;
