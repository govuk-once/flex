import type { Logger } from "@flex/logging";
import type {
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import type { ZodType } from "zod";

// ----------------------------------------------------------------------------
// Flex Function
// ----------------------------------------------------------------------------

// Add more fields if needed, based on Nodejsfunction
export interface FunctionConfig {
  environment?: Readonly<Record<string, string>>;
  memorySize?: number;
  timeoutSeconds?: number;
}

// ----------------------------------------------------------------------------
// Headers
// ----------------------------------------------------------------------------

export interface HeaderConfig {
  readonly name: string;
  readonly required?: boolean;
}

// ----------------------------------------------------------------------------
// Resources
// ----------------------------------------------------------------------------

export interface DomainResource<T extends string = string> {
  readonly type: T;
  readonly path: string;
}

type MergeRouteHeaders<
  Config extends DomainConfig,
  RouteConfig,
> = (Config extends {
  readonly common: {
    readonly headers: infer CommonHeaders extends Readonly<
      Record<string, HeaderConfig>
    >;
  };
}
  ? CommonHeaders
  : unknown) &
  (RouteConfig extends {
    readonly headers: infer RouteHeaders extends Readonly<
      Record<string, HeaderConfig>
    >;
  }
    ? RouteHeaders
    : unknown);

type ResolveHeaders<Headers> = keyof Headers extends never
  ? unknown
  : {
      readonly headers: {
        readonly [Key in keyof Headers]: Headers[Key] extends {
          readonly required: false;
        }
          ? string | undefined
          : string;
      };
    };

// ----------------------------------------------------------------------------
// Integrations
// ----------------------------------------------------------------------------

export interface DomainIntegrationOptions<
  Body extends ZodType = ZodType,
  Response extends ZodType = ZodType,
> {
  readonly target?: string;
  readonly body?: Body;
  readonly response?: Response;
}

export type InferDomainIntegrationOptions<
  Route extends string,
  Body extends ZodType = ZodType,
  Response extends ZodType = ZodType,
> = Route extends `${string}/*`
  ? Pick<DomainIntegrationOptions<Body, Response>, "target">
  : DomainIntegrationOptions<Body, Response>;

export type IntegrationResult<Data = unknown> =
  | { readonly ok: true; readonly status: number; readonly data: Data }
  | {
      readonly ok: false;
      readonly error: {
        readonly status: number;
        readonly message: string;
        readonly body?: unknown;
      };
    };

interface IntegrationRequestBase {
  headers?: Readonly<Record<string, string>>;
  query?: Readonly<Record<string, string>>;
}

interface IntegrationRequest<Body = unknown> extends IntegrationRequestBase {
  path: string;
  body: Body;
}

interface IntegrationPathRequest extends IntegrationRequestBase {
  path: string;
}

interface IntegrationBodyRequest<
  Body = unknown,
> extends IntegrationRequestBase {
  body: Body;
}

type InferIntegrationMethod<Integration extends DomainIntegration> =
  Integration extends {
    readonly route: `${infer Method extends HttpMethod} ${string}`;
  }
    ? Method
    : never;

type InferIntegrationBody<Integration extends DomainIntegration> =
  Integration extends { readonly body?: infer Body }
    ? Body extends ZodType<infer Data>
      ? Data
      : unknown
    : unknown;

type InferIntegrationResponse<Integration extends DomainIntegration> =
  Integration extends { readonly response?: infer Response }
    ? Response extends ZodType<infer Data>
      ? Data
      : unknown
    : unknown;

type IsWildcardRoute<Integration extends DomainIntegration> =
  Integration extends {
    readonly route: `${HttpMethod} ${string}/*`;
  }
    ? true
    : false;

type IntegrationInvoke<Integration extends DomainIntegration> =
  IsWildcardRoute<Integration> extends true
    ? InferIntegrationMethod<Integration> extends HttpMethodWithBody
      ? (
          options: IntegrationRequest<InferIntegrationBody<Integration>>,
        ) => Promise<IntegrationResult<InferIntegrationResponse<Integration>>>
      : (
          options: IntegrationPathRequest,
        ) => Promise<IntegrationResult<InferIntegrationResponse<Integration>>>
    : InferIntegrationMethod<Integration> extends HttpMethodWithBody
      ? (
          options: IntegrationBodyRequest<InferIntegrationBody<Integration>>,
        ) => Promise<IntegrationResult<InferIntegrationResponse<Integration>>>
      : (
          options?: IntegrationRequestBase,
        ) => Promise<IntegrationResult<InferIntegrationResponse<Integration>>>;

// ----------------------------------------------------------------------------
// Integrations / Service Gateway & Domain
// ----------------------------------------------------------------------------

export interface IntegrationDomainService<
  Route extends string = string,
  Body extends ZodType = ZodType,
  Response extends ZodType = ZodType,
> extends DomainIntegrationOptions<Body, Response> {
  readonly type: "domain";
  readonly route: Route;
}

export interface IntegrationServiceGateway<
  Route extends string = string,
  Body extends ZodType = ZodType,
  Response extends ZodType = ZodType,
> extends DomainIntegrationOptions<Body, Response> {
  readonly type: "gateway";
  readonly route: Route;
}

export type DomainIntegration =
  | IntegrationDomainService
  | IntegrationServiceGateway;

// ----------------------------------------------------------------------------
// Utility
// ----------------------------------------------------------------------------

export type InferResourceKeys<Config extends DomainConfig> = Config extends {
  readonly resources: Readonly<
    Record<infer DomainResourceKey extends string, DomainResource>
  >;
}
  ? DomainResourceKey
  : never;

export type InferIntegrationKeys<Config extends DomainConfig> = Config extends {
  readonly integrations: Readonly<
    Record<infer IntegrationKey extends string, DomainIntegration>
  >;
}
  ? IntegrationKey
  : never;

type ExtractPathParams<Path extends string> =
  Path extends `${string}:${infer PathParam}/${infer RemainingPath}`
    ? PathParam | ExtractPathParams<`/${RemainingPath}`>
    : Path extends `${string}:${infer PathParam}`
      ? PathParam
      : never;

type ExtractRouteSegments<Route extends string> =
  Route extends `${infer Method extends HttpMethod} /${infer Version}/${infer Path} [private]`
    ? {
        method: Method;
        version: Version;
        path: `/${Path}`;
        gateway: "private";
      }
    : Route extends `${infer Method extends HttpMethod} /${infer Version}/${infer Path}`
      ? {
          method: Method;
          version: Version;
          path: `/${Path}`;
          gateway: "public";
        }
      : never;

type ExtractRoutePath<Route extends string> =
  Route extends `${HttpMethod} /${string}/${infer Path} [private]`
    ? `/${Path}`
    : Route extends `${HttpMethod} /${string}/${infer Path}`
      ? `/${Path}`
      : never;

type ExtractGatewayRouteConfig<
  Gateway,
  GatewayAccess extends "public" | "private",
> = GatewayAccess extends "private"
  ? Gateway extends { readonly private: infer PrivateRouteConfig }
    ? PrivateRouteConfig
    : never
  : Gateway extends { readonly public: infer PublicRouteConfig }
    ? PublicRouteConfig
    : never;

export type DomainRoutes<Config extends DomainConfig> = Config extends {
  readonly routes: infer ConfigRoutes;
}
  ? {
      [Version in keyof ConfigRoutes & string]: {
        [Path in keyof ConfigRoutes[Version] & string]: {
          [Method in keyof ConfigRoutes[Version][Path] & HttpMethod]:
            | (ConfigRoutes[Version][Path][Method] extends {
                readonly public: unknown;
              }
                ? `${Method} /${Version}${Path}`
                : never)
            | (ConfigRoutes[Version][Path][Method] extends {
                readonly private: unknown;
              }
                ? `${Method} /${Version}${Path} [private]`
                : never);
        }[keyof ConfigRoutes[Version][Path] & HttpMethod];
      }[keyof ConfigRoutes[Version] & string];
    }[keyof ConfigRoutes & string]
  : never;

type ResolveRouteAccess<Config, RouteConfig> = RouteConfig extends {
  readonly access: infer Access extends RouteAccess;
}
  ? Access
  : Config extends {
        readonly common: {
          readonly access: infer CommonRouteAccess extends RouteAccess;
        };
      }
    ? CommonRouteAccess
    : "isolated";

export type ResolveRouteConfig<Config, Route extends string> =
  ExtractRouteSegments<Route> extends {
    method: infer Method extends HttpMethod;
    version: infer Version extends string;
    path: infer Path extends string;
    gateway: infer Gateway extends "public" | "private";
  }
    ? Config extends { readonly routes: infer ConfigRoutes }
      ? Version extends keyof ConfigRoutes
        ? Path extends keyof ConfigRoutes[Version]
          ? Method extends keyof ConfigRoutes[Version][Path]
            ? ExtractGatewayRouteConfig<
                ConfigRoutes[Version][Path][Method],
                Gateway
              >
            : never
          : never
        : never
      : never
    : never;

// ----------------------------------------------------------------------------
// Lambda
// ----------------------------------------------------------------------------

export interface LambdaAuthorizerContext {
  readonly pairwiseId?: string;
}

export type LambdaEvent =
  APIGatewayProxyEventV2WithLambdaAuthorizer<LambdaAuthorizerContext>;

export type LambdaContext = Context;

export type LambdaResult = APIGatewayProxyStructuredResultV2;

// ----------------------------------------------------------------------------
// Route Gateway
// ----------------------------------------------------------------------------

export type GatewayRouteConfig<
  Method extends HttpMethod,
  ResourceKeys extends string = string,
  IntegrationKeys extends string = string,
> =
  | {
      readonly public: MethodRouteConfig<Method, ResourceKeys, IntegrationKeys>;
      readonly private?: MethodRouteConfig<
        Method,
        ResourceKeys,
        IntegrationKeys
      >;
    }
  | {
      readonly public?: MethodRouteConfig<
        Method,
        ResourceKeys,
        IntegrationKeys
      >;
      readonly private: MethodRouteConfig<
        Method,
        ResourceKeys,
        IntegrationKeys
      >;
    };

// ----------------------------------------------------------------------------
// Domain Config
// ----------------------------------------------------------------------------

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

type HttpMethodWithBody = Extract<HttpMethod, "POST" | "PUT" | "PATCH">;

export type LogLevel =
  | "TRACE"
  | "DEBUG"
  | "INFO"
  | "WARN"
  | "ERROR"
  | "SILENT"
  | "CRITICAL";

export type RouteAccess = "public" | "private" | "isolated";

interface DomainConfigCommon {
  readonly access?: RouteAccess;
  readonly logLevel?: LogLevel;
  readonly function?: FunctionConfig;
  readonly headers?: Readonly<Record<string, HeaderConfig>>;
}

type MethodRouteConfig<
  Method extends HttpMethod,
  ResourceKeys extends string = string,
  IntegrationKeys extends string = string,
> = {
  readonly name: string;
  readonly access?: RouteAccess;
  readonly function?: FunctionConfig;
  readonly body?: Method extends HttpMethodWithBody ? ZodType : never;
  readonly logLevel?: LogLevel;
  readonly query?: ZodType;
  readonly response?: ZodType;
  readonly resources?: readonly ResourceKeys[];
  readonly integrations?: readonly IntegrationKeys[];
  readonly headers?: Readonly<Record<string, HeaderConfig>>;
};

type PathRoutes<
  ResourceKeys extends string = string,
  IntegrationKeys extends string = string,
> = {
  readonly [Method in HttpMethod]?: GatewayRouteConfig<
    Method,
    ResourceKeys,
    IntegrationKeys
  >;
};

type VersionRoutes<
  ResourceKeys extends string = string,
  IntegrationKeys extends string = string,
> = Readonly<Record<string, PathRoutes<ResourceKeys, IntegrationKeys>>>;

export interface DomainConfig<
  ResourceKeys extends string = string,
  IntegrationKeys extends string = string,
> {
  readonly name: string;
  readonly routes: Readonly<
    Record<
      string,
      VersionRoutes<NoInfer<ResourceKeys>, NoInfer<IntegrationKeys>>
    >
  >;
  readonly common?: DomainConfigCommon;
  readonly owner?: string;
  readonly resources?: Readonly<Record<ResourceKeys, DomainResource>>;
  readonly integrations?: Readonly<Record<IntegrationKeys, DomainIntegration>>;
}

export interface DomainResult<Config extends DomainConfig> {
  readonly config: Config;
  readonly route: RouteHandler<Config>;
  readonly routeContext: <Route extends DomainRoutes<Config> = never>() => [
    Route,
  ] extends [never]
    ? '[ERROR] Must provide a generic type matching a known domain route key. E.g. routeContext<"GET /v1/path">()'
    : InferRouteContext<Config, Route>;
}

// ----------------------------------------------------------------------------
// Route Context & Handler
// ----------------------------------------------------------------------------

type WithAuth<Access extends RouteAccess> = Access extends "public"
  ? unknown
  : { readonly auth: RouteAuth };

type WithHeaders<Config extends DomainConfig, RouteConfig> = ResolveHeaders<
  MergeRouteHeaders<Config, RouteConfig>
>;

type WithResources<RouteConfig> = RouteConfig extends {
  readonly resources: readonly (infer ResourceKey extends string)[];
}
  ? [ResourceKey] extends [never]
    ? unknown
    : { readonly resources: { readonly [Key in ResourceKey]: string } }
  : unknown;

type WithIntegrations<
  Config extends DomainConfig,
  RouteConfig,
> = RouteConfig extends {
  readonly integrations: readonly (infer IntegrationKey extends string)[];
}
  ? Config extends {
      readonly integrations: infer RouteIntegrations extends Readonly<
        Record<string, DomainIntegration>
      >;
    }
    ? [IntegrationKey] extends [never]
      ? unknown
      : {
          readonly integrations: {
            readonly [Key in IntegrationKey]: Key extends keyof RouteIntegrations
              ? IntegrationInvoke<RouteIntegrations[Key]>
              : never;
          };
        }
    : unknown
  : unknown;

type WithPathParams<Path extends string> = [ExtractPathParams<Path>] extends [
  never,
]
  ? unknown
  : {
      readonly pathParams: {
        readonly [Key in ExtractPathParams<Path>]: string;
      };
    };

type WithQueryParams<RouteConfig> = RouteConfig extends {
  readonly query: ZodType<infer QueryParams>;
}
  ? { readonly queryParams: QueryParams }
  : unknown;

type WithBody<RouteConfig> = RouteConfig extends {
  readonly body: ZodType<infer Body>;
}
  ? { readonly body: Body }
  : unknown;

export interface RouteAuth {
  readonly pairwiseId: string;
}

export type HandlerResult =
  | { readonly status: number; readonly data?: unknown; readonly error?: never }
  | {
      readonly status: number;
      readonly data?: never;
      readonly error?: unknown;
    };

type RouteHandlerResult<RouteConfig> = RouteConfig extends {
  readonly response: ZodType<infer Data>;
}
  ?
      | { readonly status: number; readonly data: Data; readonly error?: never }
      | {
          readonly status: number;
          readonly data?: never;
          readonly error?: unknown;
        }
  : HandlerResult;

type RouteContext<
  Route extends string,
  Config extends DomainConfig,
  RouteConfig,
> = { readonly logger: Logger } & WithAuth<
  ResolveRouteAccess<Config, RouteConfig>
> &
  WithResources<RouteConfig> &
  WithIntegrations<Config, RouteConfig> &
  WithHeaders<Config, RouteConfig> &
  WithPathParams<ExtractRoutePath<Route>> &
  WithQueryParams<RouteConfig> &
  WithBody<RouteConfig>;

export type FlexLambdaHandler = (
  event: LambdaEvent,
  context: LambdaContext,
) => Promise<LambdaResult>;

export interface RouteHandler<Config extends DomainConfig> {
  <const Route extends DomainRoutes<Config>>(
    route: Route,
    handler: (
      context: RouteContext<Route, Config, ResolveRouteConfig<Config, Route>>,
    ) => Promise<RouteHandlerResult<ResolveRouteConfig<Config, Route>>>,
  ): FlexLambdaHandler;
}

export type InferRouteContext<
  Config extends DomainConfig,
  Route extends DomainRoutes<Config>,
> = RouteContext<Route, Config, ResolveRouteConfig<Config, Route>>;
