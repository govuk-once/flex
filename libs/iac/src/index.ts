import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { z } from "zod";

const DomainEndpointSchema = z.object({
  entry: z.string(),
  method: z.nativeEnum(HttpMethod),
  path: z.string(),
  type: z.enum(["PUBLIC", "PRIVATE", "ISOLATED"]),
  // environment: z.record(z.string(), z.any()).optional(),
});

export const RoutesSchema = z.object({
  domain: z.string(),
  routes: z.array(DomainEndpointSchema),
});

export type IRoutes = z.infer<typeof RoutesSchema>;
export type IDomainEndpoint = z.infer<typeof DomainEndpointSchema>;
