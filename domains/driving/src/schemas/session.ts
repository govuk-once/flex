import { authenticateResponseSchema } from "@flex/dvsa-service-gateway";
import type { z } from "zod";

export const SessionSchema = authenticateResponseSchema;
export type Session = z.output<typeof SessionSchema>;
