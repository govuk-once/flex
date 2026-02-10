export type { IDomain, IDomainEndpoint, Permission } from "./domain";
export { defineDomain, domain, domainSchema } from "./domain";
export { header } from "./header";
export { integration } from "./integration";
export { resource } from "./resource";
export { extractRouteKeySegments } from "./route";
export { fail, ok } from "./route/response";
export { getRouteStore } from "./route/store";
export type { IacDomainConfig } from "./schema";
export { DomainConfigSchema } from "./schema";
export type {
  DomainConfig,
  DomainIntegration,
  DomainIntegrationOptions,
  DomainResource,
  DomainResult,
  DomainRoutes,
  FlexLambdaHandler,
  FunctionConfig,
  HandlerResult,
  HeaderConfig,
  HttpMethod,
  InferDomainIntegrationOptions,
  InferRouteContext,
  IntegrationDomainService,
  IntegrationResult,
  IntegrationServiceGateway,
  LambdaAuthorizerContext,
  LogLevel,
  RouteAccess,
  RouteAuth,
  RouteHandler,
} from "./types";
