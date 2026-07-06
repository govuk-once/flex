import z from "zod";

import { commonRequestSchema } from "../common";
import { customerDriversLicenceSchema } from "../domain/customerDrivingLicence";

export type CustomerDrivingLicenceRequestSchema = z.infer<
  typeof commonRequestSchema
>;

export type CustomerDriversLicenceResponse = z.infer<
  typeof customerDriversLicenceSchema
>;
