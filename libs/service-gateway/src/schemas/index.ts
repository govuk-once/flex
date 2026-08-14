import {
  EnvironmentSchema,
  HeaderConfigSchema,
  NonEmptyString,
  ResourceScopeSchema,
  RouteAccessSchema,
  RouteKeySchema,
} from "@flex/utils";
import type { ZodType } from "zod";
import { z } from "zod";

const ResourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("kms"),
    path: NonEmptyString,
    scope: ResourceScopeSchema.optional(),
  }),
  z.object({
    type: z.literal("role"),
    path: NonEmptyString,
    scope: ResourceScopeSchema.optional(),
  }),
  z.object({
    type: z.literal("secret"),
    path: NonEmptyString,
    env: NonEmptyString,
    scope: ResourceScopeSchema.optional(),
    config: z.custom<ZodType>().optional(),
  }),
  z.object({
    type: z.literal("ssm"),
    path: NonEmptyString,
    scope: ResourceScopeSchema.optional(),
  }),
]);

const PolicySchema = z.object({});

const FunctionConfigSchema = z.object({
  enableDefaultAlarms: z.boolean().optional(),
});

const RouteSchema = z.object({
  name: NonEmptyString,
  headers: z.record(NonEmptyString, HeaderConfigSchema).optional(),
  query: z.custom<ZodType>().optional(),
  body: z.custom<ZodType>().optional(),
  response: z.custom<ZodType>().optional(),
});

export const GatewayConfigSchema = z.object({
  name: NonEmptyString,
  environments: z.array(EnvironmentSchema).readonly(),
  access: RouteAccessSchema,
  resources: z.record(NonEmptyString, ResourceSchema),
  policy: PolicySchema.optional(),
  function: FunctionConfigSchema.optional(),
  routes: z.record(RouteKeySchema, RouteSchema),
});

export type ValidatedGatewayConfig = z.output<typeof GatewayConfigSchema>;
