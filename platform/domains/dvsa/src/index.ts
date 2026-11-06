export { authenticateResponseSchema } from "./schemas/domain/authenticate";
export {
  motTestSchema,
  motVehicleResponseSchema,
  newRegVehicleResponseSchema,
  vehicleByRegistrationResponseSchema,
} from "./schemas/domain/mot";
export type { AuthenticateResponseSchema } from "./schemas/remote/authenticate";
export type {
  MotTest,
  MotVehicleResponse,
  NewRegVehicleResponse,
  VehicleByRegistrationResponse,
} from "./schemas/remote/mot";
