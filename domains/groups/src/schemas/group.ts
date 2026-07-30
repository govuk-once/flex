import { z } from "zod";

const UnsGroupSchema = z.object({
  Namespace: z.string(),
  Group: z.string(),
  Subgroup: z.string().optional(),
});

export type Group = z.infer<typeof UnsGroupSchema>;

export const UnsGroupsResponseSchema = z.array(UnsGroupSchema);

export const GroupSubscriptionSchema = UnsGroupSchema.extend({
  Type: z.literal("NOTIFICATION"),
});

export const GroupsResponseSchema = z.array(GroupSubscriptionSchema);

export const UnsGroupActionSchema = UnsGroupSchema.extend({
  Action: z.enum(["JOIN", "LEAVE"]),
});

export const UnsGroupsRequestSchema = z.array(UnsGroupActionSchema);

export const GroupSubscriptionActionSchema = GroupSubscriptionSchema.extend({
  Action: z.enum(["JOIN", "LEAVE"]),
});

export const GroupsRequestSchema = z.array(GroupSubscriptionActionSchema);
