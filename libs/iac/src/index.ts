import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { z } from "zod";

const DomainEndpointSchema = z.object({
  entry: z.string(),
  method: z.nativeEnum(HttpMethod),
  path: z.string(),
  type: z.enum(["PUBLIC", "PRIVATE", "ISOLATED"]),
  envSecret: z.record(z.string(), z.string()).optional(),
});

const RouteVersionSchema = z.object({
  id: z.string(),
  prefix: z.string(),
  routes: z.array(DomainEndpointSchema),
});

export const RoutesSchema = z.object({
  domain: z.string(),
  versions: z.array(RouteVersionSchema),
});

export type IRoutes = z.infer<typeof RoutesSchema>;
export type IDomainEndpoint = z.infer<typeof DomainEndpointSchema>;
