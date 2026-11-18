import { z } from "zod";

export const ForwardedCorrelationIdResponseSchema = z.object({
  correlationId: z.string().nullable(),
});

export const CorrelationIdResponseSchema = z.object({
  correlationId: z.string().nullable(),
  forwardedCorrelationId: z.string().nullable(),
});
