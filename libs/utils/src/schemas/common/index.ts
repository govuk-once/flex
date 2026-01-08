import { z } from "zod";

// ============================================================================
// PRIMITIVES
// ============================================================================

export const Uuid = z.uuid();
export type Uuid = z.output<typeof Uuid>;

export const Url = z.url();
export type Url = z.output<typeof Url>;

export const IsoDateTime = z.iso.datetime();
export type IsoDateTime = z.output<typeof IsoDateTime>;

export const Jwt = z.jwt();
export type Jwt = z.output<typeof Jwt>;

export const NonEmptyString = z.string().min(1);
export type NonEmptyString = z.output<typeof NonEmptyString>;

export const Slug = z.string().refine((v) => /^[a-z]+(-[a-z]+)*$/.test(v), {
  error: "Must be a lowercase slug",
});
export type Slug = z.output<typeof Slug>;

// ============================================================================
// HTTP / HEADERS
// ============================================================================

export const TraceId = Uuid.meta({
  description: "Unique identifier for distributed tracing",
  example: "[UUID v4]",
});
export type TraceId = z.output<typeof TraceId>;

export const RequestId = Uuid.meta({
  description: "Unique identifier for the request correlation",
  example: "[UUID v4]",
});
export type RequestId = z.output<typeof RequestId>;

export const Authorization = z
  .string()
  .refine((v) => v.startsWith("Bearer ") && Jwt.safeParse(v.slice(7)).success, {
    error: "Must be a valid Bearer JWT token",
  })
  .meta({
    description: "Authorization header containing a Bearer JWT token",
    example: "Bearer [token]",
  });
export type Authorization = z.output<typeof Authorization>;

export const TracingHeaders = z
  .object({
    "x-trace-id": TraceId,
    "x-request-id": RequestId,
  })
  .meta({
    description: "Tracing headers for request correlation",
    example: {
      "x-trace-id": "[UUID v4]",
      "x-request-id": "[UUID v4]",
    },
  });
export type TracingHeaders = z.output<typeof TracingHeaders>;

export const AuthenticatedHeaders = TracingHeaders.extend({
  authorization: Authorization,
}).meta({
  description: "Required headers for authenticated requests",
  example: {
    "x-trace-id": "[UUID v4]",
    "x-request-id": "[UUID v4]",
    authorization: "Bearer [token]",
  },
});
