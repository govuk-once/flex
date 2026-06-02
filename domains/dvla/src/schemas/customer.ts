import { CustomerSummaryWithoutIdSchema } from "@flex/dvla-service-gateway";
import type { z } from "zod";

// TODO: Improve types

export const CustomerSummarySchema = CustomerSummaryWithoutIdSchema;
export type CustomerSummary = z.output<typeof CustomerSummarySchema>;
