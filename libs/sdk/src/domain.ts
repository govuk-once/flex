import { z } from "zod";

import { createRouteContext, createRouteHandler } from "./route";
import type {
  DomainConfig,
  DomainResult,
  InferFeatureFlagKeys,
  InferIntegrationKeys,
  InferResourceKeys,
} from "./types";

// ----------------------------------------------------------------------------
// PoC Domain
// ----------------------------------------------------------------------------

export function domain<
  const Config extends DomainConfig<
    InferResourceKeys<Config>,
    InferIntegrationKeys<Config>,
    InferFeatureFlagKeys<Config>
  >,
>(config: Config): DomainResult<Config> {
  return {
    config,
    route: createRouteHandler(config),
    routeContext: createRouteContext(config),
  };
}

// ----------------------------------------------------------------------------
// Hello/UDP Domains
// ----------------------------------------------------------------------------

const handlerConfigSchema = z.object({
  entry: z.string(),
  type: z.enum(["PUBLIC", "PRIVATE", "ISOLATED"]),
  env: z.record(z.string(), z.string()).optional(),
  envEphemeral: z.record(z.string(), z.string()).optional(),
  envSecret: z.record(z.string(), z.string()).optional(),
  kmsKeys: z.record(z.string(), z.string()).optional(),
  permissions: z
    .array(
      z.object({
        type: z.enum(["domain", "gateway"]),
        path: z.string(),
        method: z.string(),
        target: z.string(),
      }),
    )
    .optional(),
  timeoutSeconds: z.number().optional(),
});

const routeMethodsSchema = z
  .object(
    Object.fromEntries(
      ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => [
        m,
        handlerConfigSchema,
      ]),
    ),
  )
  .partial();

const versionRouteSchema = z.record(
  z.string().startsWith("/"),
  routeMethodsSchema,
);

export const domainSchema = z.object({
  domain: z.string(),
  owner: z.string().optional(),
  versions: z.record(z.string(), z.object({ routes: versionRouteSchema })),
});
