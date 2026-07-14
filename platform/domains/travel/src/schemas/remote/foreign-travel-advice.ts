import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const ForeignTravelAdviceChildSchema = z.object({
  content_id: NonEmptyString,
  api_path: NonEmptyString,
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
