import z from "zod";

import { commonRequestSchema } from "../common";
import { viewDriverResponseSchema } from "../domain/drivingLicences";

export type GetLicenceRequestSchema = z.infer<typeof commonRequestSchema>;
export type GetLicenceResponseSchema = z.infer<typeof viewDriverResponseSchema>;
