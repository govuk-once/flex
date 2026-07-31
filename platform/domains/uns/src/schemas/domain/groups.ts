import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const UnsGroupsGetRequestSchema = z.object({
  pushId: NonEmptyString,
});

export const UnsGroupSchema = z.object({
  Namespace: z.string(),
  Group: z.string(),
  Subgroup: z.string().optional(),
});

export const UnsGroupActionSchema = UnsGroupSchema.extend({
  Action: z.enum(["JOIN", "LEAVE"]),
});

export const UnsGroupsRequestBodySchema = z.array(UnsGroupActionSchema);

export const UnsGroupsPostRequestSchema = z.object({
  pushId: NonEmptyString,
  body: UnsGroupsRequestBodySchema,
});

export const UnsGroupsResponseSchema = z.array(UnsGroupSchema);
