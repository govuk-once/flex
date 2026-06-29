import type { ApiResult } from "@flex/flex-fetch";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";

import type { GatewayClientMap } from "./client";
import type {
  GatewayContext,
  GatewayHandlerContext,
  GatewayOutboundData,
} from "./context";
import type { GatewayConfig, RouteKeyOf } from "./gateway";
import type { ResolvedResources, ResourceMap } from "./resource";

export type GatewayClientBuilder<
  Resources extends ResourceMap,
  Clients extends GatewayClientMap,
> = (resources: ResolvedResources<Resources>) => Clients;

export type GatewayHandlerMap<
  Config extends GatewayConfig,
  Clients extends GatewayClientMap,
> = {
  [Route in RouteKeyOf<Config>]: (
    context: GatewayHandlerContext<Config, Route, Clients>,
  ) => Promise<ApiResult<GatewayOutboundData<Config["routes"][Route]>>>;
};

export type GatewayRouteHandler = (
  context: GatewayContext,
) => Promise<ApiResult<unknown>>;

export interface GatewayHandlerInput<
  Config extends GatewayConfig,
  Clients extends GatewayClientMap,
> {
  readonly clients: GatewayClientBuilder<Config["resources"], Clients>;
  readonly routes: GatewayHandlerMap<Config, Clients>;
}

export type GatewayLambda = (
  event: APIGatewayProxyEvent,
  context: Context,
) => Promise<APIGatewayProxyResultV2>;

export interface Gateway<Config extends GatewayConfig> {
  readonly config: Config;
  readonly createHandler: <const Clients extends GatewayClientMap>(input: {
    clients: GatewayClientBuilder<Config["resources"], Clients>;
    routes: GatewayHandlerMap<Config, Clients>;
  }) => GatewayLambda;
}
