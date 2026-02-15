import { z } from "zod";

const consentDataSchema = z.object({
  consentStatus: z.string(),
  updatedAt: z.string(),
});

export const consentResponseSchema = z.union([
  z.object({ data: consentDataSchema }),
  consentDataSchema,
]);

export type ConsentData = z.output<typeof consentDataSchema>;
