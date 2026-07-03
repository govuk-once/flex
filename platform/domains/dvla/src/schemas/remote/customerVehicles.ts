import z from "zod";

import { commonRequestSchema } from "../common";
import { customerVehiclesResponseSchema } from "../domain/customerVehicles";

export type CustomerVehiclesRequestSchema = z.infer<typeof commonRequestSchema>;

export type CustomerVehiclesResponse = z.infer<
  typeof customerVehiclesResponseSchema
>;
