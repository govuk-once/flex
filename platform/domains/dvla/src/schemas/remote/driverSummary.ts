import z from "zod";

import { commonRequestSchema } from "../common";
import { RetrieveDriverSummaryByLinkingIdResponse } from "../domain/driverSummary";

export type GetDriverSummaryRequestSchema = z.infer<typeof commonRequestSchema>;
export type GetDriverSummaryResponseSchema = z.infer<
  typeof RetrieveDriverSummaryByLinkingIdResponse
>;
