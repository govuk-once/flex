import z from "zod";

import {
  vehicleEnquiryRequestBodySchema,
  vehicleEnquiryResponseSchema,
} from "../domain/vehicleEnquiry";

export type VehicleEnquiryRequestBodySchema = z.infer<
  typeof vehicleEnquiryRequestBodySchema
>;

export type VehicleEnquiryResponseSchema = z.infer<
  typeof vehicleEnquiryResponseSchema
>;
