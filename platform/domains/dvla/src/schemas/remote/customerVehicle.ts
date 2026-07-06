import z from "zod";

import {
  customerVehicleDetailsSchema,
  customerVehicleRequestSchema,
} from "../domain/customerVehicle";

export type CustomerVehicleRequestSchema = z.infer<
  typeof customerVehicleRequestSchema
>;

export type CustomerVehicleResponse = z.infer<
  typeof customerVehicleDetailsSchema
>;
