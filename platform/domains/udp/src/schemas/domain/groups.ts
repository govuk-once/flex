import { z } from "zod";

export const NotificationGroupSubscriptionSchema = z.object({
  Namespace: z.string(),
  Group: z.string(),
  Subgroup: z.string().optional(),
  Type: z.literal("NOTIFICATION"),
});

export type NotificationGroupSubscription = z.infer<typeof NotificationGroupSubscriptionSchema>;

export const DomainGroupsSchema = z.array(NotificationGroupSubscriptionSchema);

export type DomainGroups = z.infer<typeof DomainGroupsSchema>;
