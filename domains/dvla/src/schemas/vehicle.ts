import type { vehicleEnquiryResponseSchema } from "@flex/dvla-service-gateway";
import type { z } from "zod";

// TODO: Improve types

export {
  customerVehicleDetailsSchema as CustomerVehicleSchema,
  customerVehiclesResponseSchema as CustomerVehiclesSchema,
  vehicleEnquiryResponseSchema as VehicleSchema,
} from "@flex/dvla-service-gateway";
export type Vehicle = z.output<typeof vehicleEnquiryResponseSchema>;
