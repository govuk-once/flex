export { authenticateResponseSchema } from "./schemas/domain/authenticate";
export { customerDriversLicenceSchema } from "./schemas/domain/customerDrivingLicence";
export { customerVehicleDetailsSchema } from "./schemas/domain/customerVehicle";
export { customerVehiclesResponseSchema } from "./schemas/domain/customerVehicles";
export {
  ShareCodeSchema,
  SingleShareCodeResponseSchema,
  SingleShareCodeResponseSchemaWithoutIdSchema,
} from "./schemas/domain/shareCode";
export {
  vehicleEnquiryRequestBodySchema,
  vehicleEnquiryResponseSchema,
} from "./schemas/domain/vehicleEnquiry";
export type { AuthenticateResponseSchema } from "./schemas/remote/authenticate";
export type { CustomerDriversLicenceResponse } from "./schemas/remote/custmerDrivingLicence";
export type { CustomerVehicleResponse } from "./schemas/remote/customerVehicle";
export type { CustomerVehiclesResponse } from "./schemas/remote/customerVehicles";
export type {
  ShareCode,
  SingleShareCodeResponse,
} from "./schemas/remote/shareCode";
export type {
  VehicleEnquiryRequestBodySchema,
  VehicleEnquiryResponseSchema,
} from "./schemas/remote/vehicleEnquiry";
