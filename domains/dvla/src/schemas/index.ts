import {
  MultiShareCodeResponseSchema,
  RetrieveCustomerSummaryByLinkingIdResponse,
  RetrieveDriverSummaryByLinkingIdResponse,
  SingleShareCodeResponseSchema,
} from "@flex/dvla-service-gateway";

export const DriverSummaryWithoutIdSchema =
  RetrieveDriverSummaryByLinkingIdResponse.omit({ linkingId: true });

export const CustomerSummaryWithoutIdSchema =
  RetrieveCustomerSummaryByLinkingIdResponse.omit({ linkingId: true });

export const MultiShareCodeResponseSchemaWithoutIdSchmea =
  MultiShareCodeResponseSchema.omit({ linkingId: true });

export const SingleShareCodeResponseSchemaWithoutIdSchema =
  SingleShareCodeResponseSchema.omit({ linkingId: true });
