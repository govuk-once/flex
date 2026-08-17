import { z } from "zod";

export const notificationGroupSubscriptionSchema = z.object({
  Namespace: z.string(),
  Group: z.string(),
  Subgroup: z.string().optional(),
  Type: z.literal("NOTIFICATION"),
});

export const domainGroupsSchema = z.array(notificationGroupSubscriptionSchema);

export type DomainGroups = z.infer<typeof domainGroupsSchema>;
