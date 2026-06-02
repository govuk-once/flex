import { authenticateResponseSchema } from "@flex/dvla-service-gateway";
import type { z } from "zod";

// TODO: Improve types

export const SessionSchema = authenticateResponseSchema;
export type Session = z.output<typeof SessionSchema>;
