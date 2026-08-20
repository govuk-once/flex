import { z } from "zod";

const UnsGroupSchema = z.object({
  Namespace: z.string(),
  Group: z.string(),
  Subgroup: z.string().optional(),
});

export type Group = z.infer<typeof UnsGroupSchema>;

export const GroupTypeSchema = z.enum(["NOTIFICATION"]);

export type GroupTypeSchema = z.infer<typeof GroupTypeSchema>;

export const GroupActionSchema = z.enum(["JOIN", "LEAVE"]);

export type GroupActionSchema = z.infer<typeof GroupActionSchema>;

export const UnsGroupsResponseSchema = z.array(UnsGroupSchema);

export const NotificationGroupSubscriptionSchema = UnsGroupSchema.extend({
  Type: z.literal(GroupTypeSchema.enum.NOTIFICATION),
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
  Action: GroupActionSchema,
});

export const UnsGroupsRequestSchema = z.array(UnsGroupActionSchema);

export const NotificationGroupSubscriptionActionSchema =
  NotificationGroupSubscriptionSchema.extend({
    Action: GroupActionSchema,
  });

export const GroupSubscriptionActionSchema = z.discriminatedUnion("Type", [
  NotificationGroupSubscriptionActionSchema,
]);

export const GroupsRequestSchema = z.array(GroupSubscriptionActionSchema);
