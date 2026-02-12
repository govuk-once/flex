import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { z } from "zod";

const handlerConfigSchema = z.object({
  entry: z.string(),
  type: z.enum(["PUBLIC", "PRIVATE", "ISOLATED"]),
  env: z.record(z.string(), z.string()).optional(),
  envSecret: z.record(z.string(), z.string()).optional(),
  kmsKeys: z.record(z.string(), z.string()).optional(),
});

const routeMethodsSchema = z.record(
  z.enum(HttpMethod),
  handlerConfigSchema.optional(),
);

const versionRouteSchema = z.record(
  z.string().startsWith("/"),
  routeMethodsSchema,
);

const featureFlagsSchema = z.record(
  z.string(),
  z.object({
    name: z.string(),
    description: z.string().optional(),
    enabled: z.boolean(),
  }),
);

const domainSchema = z.object({
  domain: z.string(),
  owner: z.string().optional(),
  versions: z.record(z.string(), z.object({ routes: versionRouteSchema })),
  featureFlags: z
    .object({
      staging: featureFlagsSchema,
      production: featureFlagsSchema,
      development: featureFlagsSchema,
      default: featureFlagsSchema,
    })
    .optional(),
});

type InferredDomain = z.infer<typeof domainSchema>;
export type IDomainEndpoint = z.infer<typeof handlerConfigSchema>;
export type IFeatureFlags = z.infer<typeof featureFlagsSchema>;

export type IDomain = Omit<InferredDomain, "versions"> & {
  versions: Record<
    string,
    {
      routes: Record<string, Partial<Record<HttpMethod, IDomainEndpoint>>>;
    }
  >;
};

export function defineDomain<const T extends IDomain>(config: T) {
  domainSchema.parse(config);
  return config;
}
