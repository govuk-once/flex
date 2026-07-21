import { z } from "zod";

export const TelemetryEventSchema = z.enum([
  // Edge
  "edge_token_validated",
  "edge_token_missing",
  "edge_token_invalid",

  // Auth
  "auth_success",
  "auth_token_missing",
  "auth_token_expired",
  "auth_token_invalid",
  "auth_claim_missing",
  "auth_failure",

  // Domain
  "domain_request_received",
  "domain_response_returned",
  "domain_error_returned",

  // Service gateway
  "service_gateway_request_sent",
  "service_gateway_request_received",
  "service_gateway_response_returned",
  "service_gateway_error_returned",

  // Third party APIs
  "third_party_request_sent",
  "third_party_response_received",
  "third_party_request_retried",
  "third_party_request_timeout",
  "third_party_request_error",

  // General
  "request_validation_failed",
  "response_validation_failed",
  "error_thrown",
]);
export type TelemetryEvent = z.output<typeof TelemetryEventSchema>;
export const TelemetryEvent = TelemetryEventSchema.enum;
