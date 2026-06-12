import {
  EnvironmentSchema,
  HeaderConfigSchema,
  NonEmptyString,
  RouteAccessSchema,
} from "@flex/utils";
import type { ZodType } from "zod";
import z from "zod";

const ResourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: "kms",
    path: NonEmptyString,
    scope: z.enum(["environment", "stage"]).optional(),
  }),
  z.object({
    type: "role",
    path: NonEmptyString,
    scope: z.enum(["environment", "stage"]).optional(),
  }),
  z.object({
    type: "secret",
    path: NonEmptyString,
    env: NonEmptyString,
    scope: z.enum(["environment", "stage"]).optional(),
    config: z.custom<ZodType>().optional(),
  }),
  z.object({
    type: "ssm",
    path: NonEmptyString,
    scope: z.enum(["environment", "stage"]).optional(),
  }),
]);

const DownstreamAuthSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("public") }),
  z.object({
    type: z.literal("sigv4"),
    role: NonEmptyString,
    roleName: NonEmptyString,
  }),
]);

const DownstreamSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("remote-api"),
    ref: NonEmptyString,
    auth: DownstreamAuthSchema,
  }),
  z.object({
    type: z.literal("event-bus"),
    ref: NonEmptyString,
    auth: DownstreamAuthSchema,
  }),
]);

const PolicySchema = z.object({});

const RouteSchema = z.object({
  name: NonEmptyString,
  headers: z.record(NonEmptyString, HeaderConfigSchema).optional(),
  query: z.custom<ZodType>().optional(),
  body: z.custom<ZodType>().optional(),
});

export const GatewayConfigSchema = z.object({
  name: NonEmptyString,
  environments: z.array(EnvironmentSchema).readonly().optional(),
  access: RouteAccessSchema,
  resources: z.record(NonEmptyString, ResourceSchema),
  downstream: DownstreamSchema,
  policy: PolicySchema,
  routes: z.record(NonEmptyString, RouteSchema),
});

export type GatewayConfig = z.output<typeof GatewayConfigSchema>;
