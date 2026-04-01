import z from "zod";

import { commonRequestSchema } from "../common";
import { getCustomerResponseSchema } from "../domain/customer";

export type GetCustomerRequestSchema = z.infer<typeof commonRequestSchema>;
export type GetCustomerResponseSchema = z.infer<
  typeof getCustomerResponseSchema
>;
