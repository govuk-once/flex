import { EnvironmentSchema, NonEmptyString } from "@flex/utils";
import type { ZodType } from "zod";
import z from "zod";

import { HeaderConfigSchema } from "../config/schema";

const DownstreamRefSchema = z.object({
  type: z.enum(["secret", "ssm"]),
  path: NonEmptyString,
  env: NonEmptyString,
  scope: z.enum(["environment", "stage"]),
  config: z.custom<ZodType>().optional(),
});

const DownstreamAuthSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("public") }),
  z.object({ type: z.literal("sigv4"), roleName: NonEmptyString }),
]);

const GatewayDownstreamSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("remote-api"),
    auth: DownstreamAuthSchema,
    ref: DownstreamRefSchema,
  }),
  z.object({
    type: z.literal("event-bus"),
    auth: DownstreamAuthSchema,
    ref: DownstreamRefSchema,
  }),
]);

const GatewayPolicySchema = z.object({});

const GatewayRouteSchema = z.object({
  name: NonEmptyString,
  headers: z.record(NonEmptyString, HeaderConfigSchema).optional(),
  query: z.custom<ZodType>().optional(),
  body: z.custom<ZodType>().optional(),
});

export const GatewayConfigSchema = z.object({
  name: NonEmptyString,
  environments: z.array(EnvironmentSchema).readonly().optional(),
  downstream: GatewayDownstreamSchema,
  policy: GatewayPolicySchema,
  routes: z.record(NonEmptyString, GatewayRouteSchema),
});
