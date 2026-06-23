import type { ApiResult } from "@flex/flex-fetch";
import type { Logger } from "@flex/logging";
import type {
  Environment,
  ExtractPathParams,
  HeaderConfig,
  HttpMethod,
  Json,
  QueryParams,
  ReadonlyRecord,
  ResourceScope,
  RouteAccess,
} from "@flex/utils";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import type z from "zod";

// Helpers

type HeaderMap = Record<string, string | undefined>;

type WithSchemaField<
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

type HandlerFn<Ctx> = (context: Ctx) => Promise<DownstreamResult>;

type RouteKeys<Config extends GatewayConfig> = keyof Config["routes"] & string;

type ResourceConfigOutput<Resource> = Resource extends {
  config: infer Schema extends z.ZodType;
}
  ? z.output<Schema>
  : never;

// Resources

export type GatewayResourceType = "secret" | "kms" | "role" | "ssm";

export interface GatewayResource<Config extends z.ZodType = z.ZodType> {
  type: GatewayResourceType;
  path: string;
  env?: string;
  scope?: ResourceScope;
  config?: Config;
}

export type GatewayResources = ReadonlyRecord<string, GatewayResource>;

// Downstream

export type DownstreamResult<T = unknown> = ApiResult<T>;

export type DownstreamAuth<Role extends string = string> =
  | { type: "public" }
  | { type: "sigv4"; role: Role; roleName: string };

export interface RemoteApiDownstream {
  type: "remote-api";
  ref: string;
  auth: DownstreamAuth;
}

export interface EventBusDownstream {
  type: "event-bus";
  ref: string;
  auth: DownstreamAuth;
}

export type GatewayDownstream = RemoteApiDownstream | EventBusDownstream;

// Gateway config

export type RouteKey = `${HttpMethod} /${string}`;

export interface GatewayRoute {
  name: string;
  query?: z.ZodType;
  headers?: ReadonlyRecord<string, HeaderConfig>;
  body?: z.ZodType;
}

export type GatewayRoutes = ReadonlyRecord<RouteKey, GatewayRoute>;

export interface GatewayConfig {
  name: string;
  environments: readonly Environment[];
  access: RouteAccess;
  resources: GatewayResources;
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

type GatewayDownstreamInput<Resources extends GatewayResources> =
  | {
      type: "remote-api";
      ref: ResourceKeysOfType<Resources, "secret">;
      auth: DownstreamAuth<ResourceKeysOfType<Resources, "role">>;
    }
  | {
      type: "event-bus";
      ref: ResourceKeysOfType<Resources, "ssm">;
      auth: DownstreamAuth<ResourceKeysOfType<Resources, "role">>;
    };

export interface GatewayConfigInput<
  Resources extends GatewayResources = GatewayResources,
> {
  name: string;
  environments: readonly Environment[];
  access: RouteAccess;
  resources: Resources;
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

type DownstreamConfig<Config extends GatewayConfig> = Config extends {
  downstream: {
    type: "remote-api";
    ref: infer Key extends keyof InferResources<Config>;
  };
}
  ? ResourceConfigOutput<InferResources<Config>[Key]>
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

type WithQueryParams<RouteConfig> = WithSchemaField<
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

type WithBody<RouteConfig> = WithSchemaField<RouteConfig, "body">;

export type GatewayHandlerContext<
  Config extends GatewayConfig,
  Route extends RouteKeys<Config>,
> = {
  readonly logger: Logger;
  readonly client: DownstreamClient<Config>;
} & WithPathParams<Route> &
  WithQueryParams<Config["routes"][Route]> &
  WithHeaders<Config["routes"][Route]> &
  WithBody<Config["routes"][Route]>;

export type GatewayHandlerMap<Config extends GatewayConfig> = {
  [Route in RouteKeys<Config>]: HandlerFn<GatewayHandlerContext<Config, Route>>;
};

export interface GatewayContext {
  readonly logger: Logger;
  readonly client: GatewayClient;
  readonly pathParams?: ReadonlyRecord<string, string>;
  readonly queryParams?: ReadonlyRecord<string, unknown>;
  readonly headers?: ReadonlyRecord<string, string | undefined>;
  readonly body?: unknown;
}

export type GatewayHandler = HandlerFn<GatewayContext>;

// Gateway

export interface Gateway<Config extends GatewayConfig> {
  readonly config: Config;
  readonly createHandler: (
    handlers: GatewayHandlerMap<Config>,
  ) => GatewayLambda;
}

// Client

interface RemoteApiRequestBase {
  path: string;
  query?: QueryParams;
  headers?: HeaderMap;
}

export type RemoteApiRequest<Body extends Json = Json> =
  | (RemoteApiRequestBase & { method: "GET" | "DELETE" })
  | (RemoteApiRequestBase & { method: "POST" | "PUT" | "PATCH"; body?: Body });

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
    ? RemoteApiClient<DownstreamConfig<Config>>
    : Config["downstream"] extends { type: "event-bus" }
      ? EventBusClient
      : never;
