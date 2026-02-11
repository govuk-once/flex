import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { z } from "zod";

const permissionsSchema = z.object({
  type: z.enum(["domain", "gateway"]),
  path: z.string(),
  method: z.string(),
  // Optional: intra-domain permissions
  targetDomainId: z.string().optional(),
  // Note: direct intra-domain gateway permissions are prohibited
});

export type IPermission = z.infer<typeof permissionsSchema>;

const handlerConfigSchema = z.object({
  entry: z.string(),
  type: z.enum(["PUBLIC", "PRIVATE", "ISOLATED"]),
  env: z.record(z.string(), z.string()).optional(),
  envSecret: z.record(z.string(), z.string()).optional(),
  kmsKeys: z.record(z.string(), z.string()).optional(),
  permissions: z.array(permissionsSchema).optional(),
});

const routeMethodsSchema = z
  .object(
    Object.fromEntries(
      Object.values(HttpMethod).map((m) => [m, handlerConfigSchema]),
    ) as Record<HttpMethod, typeof handlerConfigSchema>,
  )
  .partial();

const versionRouteSchema = z.record(
  z.string().startsWith("/"),
  routeMethodsSchema,
);

const versionSchema = z.object({
  versions: z.record(z.string(), z.object({ routes: versionRouteSchema })),
});

const domainSchema = z.object({
  domain: z.string(),
  owner: z.string().optional(),
  public: versionSchema.optional(),
  private: versionSchema.optional(),
});

export type IDomainRoutes = z.infer<typeof versionSchema>;
export type IDomainEndpoint = z.infer<typeof handlerConfigSchema>;
export type IDomainVersion = z.infer<typeof versionRouteSchema>;
export type IDomainConfig = z.infer<typeof domainSchema>;

export function defineDomain<const T extends IDomainConfig>(config: T) {
  domainSchema.parse(config);
  return config;
}
