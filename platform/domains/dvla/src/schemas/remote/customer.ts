import z from "zod";

import {
  getCustomerRequestSchema,
  getCustomerResponseSchema,
} from "../domain/customer";

export type GetCustomerRequestSchema = z.infer<typeof getCustomerRequestSchema>;

export type GetCustomerResponseSchema = z.infer<
  typeof getCustomerResponseSchema
>;
