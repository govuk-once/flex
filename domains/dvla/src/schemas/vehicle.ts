import {
  customerVehicleDetailsSchema,
  customerVehiclesResponseSchema,
  vehicleEnquiryResponseSchema,
} from "@flex/dvla-service-gateway";
import type { z } from "zod";

// TODO: Improve types

export const CustomerVehicleSchema = customerVehicleDetailsSchema;
export const CustomerVehiclesSchema = customerVehiclesResponseSchema;
export const VehicleSchema = vehicleEnquiryResponseSchema;
export type Vehicle = z.output<typeof VehicleSchema>;
