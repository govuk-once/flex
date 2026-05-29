export { authenticateResponseSchema } from "./schemas/domain/authenticate";
export {
  CustomerSummaryWithoutIdSchema,
  RetrieveCustomerSummaryByLinkingIdResponse,
} from "./schemas/domain/customerSummary";
export {
  DriverSummaryWithoutIdSchema,
  RetrieveDriverSummaryByLinkingIdResponse,
} from "./schemas/domain/driverSummary";
export { viewDriverResponseSchema } from "./schemas/domain/drivingLicences";
export {
  MultiShareCodeResponseSchema,
  MultiShareCodeResponseSchemaWithoutIdSchmea,
  SingleShareCodeResponseSchema,
  SingleShareCodeResponseSchemaWithoutIdSchema,
} from "./schemas/domain/shareCode";
export {
  vehicleEnquiryRequestBodySchema,
  vehicleEnquiryResponseSchema,
} from "./schemas/domain/vehicleEnquiry";
export type { AuthenticateResponseSchema } from "./schemas/remote/authenticate";
export type { GetCustomerSummaryResponseSchema } from "./schemas/remote/customerSummary";
export type { GetDriverSummaryResponseSchema } from "./schemas/remote/driverSummary";
export type { GetLicenceResponseSchema } from "./schemas/remote/drivingLicences";
export type {
  MultiShareCodeResponse,
  SingleShareCodeResponse,
} from "./schemas/remote/shareCode";
export type {
  VehicleEnquiryRequestBodySchema,
  VehicleEnquiryResponseSchema,
} from "./schemas/remote/vehicleEnquiry";
