import { vehicleByRegistrationResponseSchema } from "@flex/dvsa-service-gateway";
import type { z } from "zod";

export const VehicleMotSchema = vehicleByRegistrationResponseSchema;
export type VehicleMot = z.output<typeof VehicleMotSchema>;
