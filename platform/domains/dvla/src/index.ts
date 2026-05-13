export { authenticateResponseSchema } from "./schemas/domain/authenticate";
export { RetrieveCustomerSummaryByLinkingIdResponse } from "./schemas/domain/customerSummary";
export { RetrieveDriverSummaryByLinkingIdResponse } from "./schemas/domain/driverSummary";
export { getLicenceResponseSchema } from "./schemas/domain/drivingLicences";
export {
  MultiShareCodeResponseSchema,
  SingleShareCodeResponseSchema,
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
