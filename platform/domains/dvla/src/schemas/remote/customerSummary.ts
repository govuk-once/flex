import z from "zod";

import { commonRequestSchema } from "../common";
import { RetrieveCustomerSummaryByLinkingIdResponse } from "../domain/customerSummary";

export type GetCustomerSummaryRequestSchema = z.infer<
  typeof commonRequestSchema
>;
export type GetCustomerSummaryResponseSchema = z.infer<
  typeof RetrieveCustomerSummaryByLinkingIdResponse
>;
