import type { ZodType } from "zod";

import type {
  InferDomainIntegrationOptions,
  IntegrationDomainService,
  IntegrationServiceGateway,
} from "./types";

export const integration = {
  domain: <
    Route extends string,
    Body extends ZodType = ZodType,
    Response extends ZodType = ZodType,
  >(
    route: Route,
    options?: InferDomainIntegrationOptions<Route, Body, Response>,
  ): IntegrationDomainService<Route, Body, Response> => ({
    type: "domain",
    route,
    ...options,
  }),
  gateway: <
    Route extends string,
    Body extends ZodType = ZodType,
    Response extends ZodType = ZodType,
  >(
    route: Route,
    options?: InferDomainIntegrationOptions<Route, Body, Response>,
  ): IntegrationServiceGateway<Route, Body, Response> => ({
    type: "gateway",
    route,
    ...options,
  }),
} as const;
