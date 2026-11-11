import { z } from "zod";

import {
  motTestSchema,
  motVehicleResponseSchema,
  newRegVehicleResponseSchema,
  vehicleByRegistrationResponseSchema,
} from "../domain/mot";

export type MotTest = z.infer<typeof motTestSchema>;
export type MotVehicleResponse = z.infer<typeof motVehicleResponseSchema>;
export type NewRegVehicleResponse = z.infer<typeof newRegVehicleResponseSchema>;
export type VehicleByRegistrationResponse = z.infer<
  typeof vehicleByRegistrationResponseSchema
>;
