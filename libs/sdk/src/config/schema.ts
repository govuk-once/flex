import { NonEmptyString } from "@flex/utils";
import type { ZodType } from "zod";
import { z } from "zod";

const RouteAccessSchema = z.enum(["public", "private", "isolated"]);

const LogLevelSchema = z.enum([
  "TRACE",
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "SILENT",
  "CRITICAL",
]);

const HttpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

const FunctionConfigSchema = z.object({
  environment: z.record(NonEmptyString, NonEmptyString).optional(),
  memorySize: z.number().int().min(128).max(10240).optional(),
  timeoutSeconds: z.number().int().min(1).max(900).optional(),
});

const HeaderConfigSchema = z.object({
  name: NonEmptyString,
  required: z.boolean().optional(),
});

const DomainIntegrationBaseSchema = z.object({
  route: NonEmptyString,
  target: NonEmptyString.optional(),
  body: z.custom<ZodType>().optional(),
  response: z.custom<ZodType>().optional(),
});

const IntegrationDomainServiceSchema = DomainIntegrationBaseSchema.extend({
  type: z.literal("domain"),
});

const IntegrationServiceGatewaySchema = DomainIntegrationBaseSchema.extend({
  type: z.literal("gateway"),
});

const DomainIntegrationSchema = z.discriminatedUnion("type", [
  IntegrationDomainServiceSchema,
  IntegrationServiceGatewaySchema,
]);

const DomainConfigCommonSchema = z.object({
  access: RouteAccessSchema.optional(),
  logLevel: LogLevelSchema.optional(),
  function: FunctionConfigSchema.optional(),
  headers: z.record(NonEmptyString, HeaderConfigSchema).optional(),
});

const DomainResourceSchema = z.object({
  type: z.enum(["secret", "ssm", "ssm:runtime", "kms"]),
  path: NonEmptyString,
  scope: z.enum(["environment", "stage"]).optional(),
});

export const FlexEnvironmentSchema = z.enum([
  "development",
  "staging",
  "production",
]);

export const DomainFeatureFlagSchema = z.object({
  description: NonEmptyString.optional(),
  default: z.boolean().optional(),
  environments: z.record(FlexEnvironmentSchema, z.boolean()).optional(),
});

const MethodRouteConfigSchema = z.object({
  name: NonEmptyString,
  access: RouteAccessSchema.optional(),
  function: FunctionConfigSchema.optional(),
  logLevel: LogLevelSchema.optional(),
  body: z.custom<ZodType>().optional(),
  query: z.custom<ZodType>().optional(),
  response: z.custom<ZodType>().optional(),
  resources: z.array(NonEmptyString).readonly().optional(),
  integrations: z.array(NonEmptyString).readonly().optional(),
  featureFlags: z.array(NonEmptyString).readonly().optional(),
  headers: z.record(NonEmptyString, HeaderConfigSchema).optional(),
});

const GatewayRouteConfigSchema = z
  .object({
    public: MethodRouteConfigSchema.optional(),
    private: MethodRouteConfigSchema.optional(),
  })
  .refine(
    (v) => v.public != null || v.private != null,
    'At least one "public" or "private" route must be defined',
  );

const PathRoutesSchema = z.record(
  HttpMethodSchema,
  GatewayRouteConfigSchema.optional(),
);

const VersionRoutesSchema = z.record(NonEmptyString, PathRoutesSchema);

export const DomainConfigSchema = z.object({
  name: NonEmptyString,
  routes: z.record(NonEmptyString, VersionRoutesSchema),
  common: DomainConfigCommonSchema.optional(),
  resources: z.record(NonEmptyString, DomainResourceSchema).optional(),
  integrations: z.record(NonEmptyString, DomainIntegrationSchema).optional(),
  featureFlags: z.record(NonEmptyString, DomainFeatureFlagSchema).optional(),
  owner: NonEmptyString.optional(),
});

export type IacDomainConfig = z.infer<typeof DomainConfigSchema>;
