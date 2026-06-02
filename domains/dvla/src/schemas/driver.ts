import {
  DriverSummaryWithoutIdSchema,
  viewDriverResponseSchema,
} from "@flex/dvla-service-gateway";
import type { z } from "zod";

// TODO: Improve types

export const DriverSummarySchema = DriverSummaryWithoutIdSchema;
export type DriverSummary = z.output<typeof DriverSummarySchema>;

export const LicenceSchema = viewDriverResponseSchema;
export type Licence = z.output<typeof LicenceSchema>;
