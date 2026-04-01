import z from "zod";

import { commonRequestSchema } from "../common";
import { getLicenceResponseSchema } from "../domain/drivingLicences";

export type GetLicenceRequestSchema = z.infer<typeof commonRequestSchema>;
export type GetLicenceResponseSchema = z.infer<typeof getLicenceResponseSchema>;
