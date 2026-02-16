import { z } from "zod";

export enum CONSENT_STATUS {
  UNKNOWN = "unknown",
  CONSENTED = "consented",
  NOT_CONSENTED = "not_consented",
}

export const CONSENT_STATUS_SCHEMA = z.enum(CONSENT_STATUS);

const consentDataSchema = z.object({
  consentStatus: CONSENT_STATUS_SCHEMA,
  updatedAt: z.string(),
});

export const consentResponseSchema = z.union([
  z.object({ data: consentDataSchema }),
  consentDataSchema,
]);

export type ConsentData = z.output<typeof consentDataSchema>;
