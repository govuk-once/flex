import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const ForeignTravelAdviceDetailsCountrySchema = z.object({
  name: NonEmptyString,
});

export const ForeignTravelAdviceDetailsSchema = z.object({
  country: ForeignTravelAdviceDetailsCountrySchema,
});

export const ForeignTravelAdviceChildSchema = z.object({
  content_id: NonEmptyString,
  api_path: NonEmptyString,
  details: ForeignTravelAdviceDetailsSchema,
});
export type ForeignTravelAdviceChild = z.output<
  typeof ForeignTravelAdviceChildSchema
>;

export const ForeignTravelAdviceResponseSchema = z.object({
  links: z.object({
    children: z.array(ForeignTravelAdviceChildSchema),
  }),
});
export type ForeignTravelAdviceResponse = z.output<
  typeof ForeignTravelAdviceResponseSchema
>;
