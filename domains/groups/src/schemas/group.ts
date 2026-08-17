import { z } from "zod";

import { GroupAction, GroupType } from "../types";

const UnsGroupSchema = z.object({
  Namespace: z.string(),
  Group: z.string(),
  Subgroup: z.string().optional(),
});

export type Group = z.infer<typeof UnsGroupSchema>;

export const UnsGroupsResponseSchema = z.array(UnsGroupSchema);

export const NotificationGroupSubscriptionSchema = UnsGroupSchema.extend({
  Type: z.literal(GroupType.NOTIFICATION),
});

export const NotificationGroupSubscriptionsSchema = z.array(
  NotificationGroupSubscriptionSchema,
);

export const GroupSubscriptionSchema = UnsGroupSchema.extend({
  Type: z.string(),
});

export const GroupsResponseSchema = z.array(GroupSubscriptionSchema);

export type GroupSubscription = z.infer<typeof GroupSubscriptionSchema>;

export const UnsGroupActionSchema = UnsGroupSchema.extend({
  Action: z.enum(GroupAction),
});

export const UnsGroupsRequestSchema = z.array(UnsGroupActionSchema);

export const NotificationGroupSubscriptionActionSchema =
  NotificationGroupSubscriptionSchema.extend({
    Action: z.enum(GroupAction),
  });

export const GroupSubscriptionActionSchema = z.discriminatedUnion("Type", [
  NotificationGroupSubscriptionActionSchema,
]);

export const GroupsRequestSchema = z.array(GroupSubscriptionActionSchema);
