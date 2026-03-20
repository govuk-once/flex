import z from "zod";

import {
  getLicenceRequestSchema,
  getLicenceResponseSchema,
} from "../domain/drivingLicences";

export type GetLicenceRequestSchema = z.infer<typeof getLicenceRequestSchema>;
export type GetLicenceResponseSchema = z.infer<typeof getLicenceResponseSchema>;
