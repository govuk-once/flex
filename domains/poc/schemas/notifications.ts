import { UpdateNotificationPreferencesOutboundResponseSchema } from "@flex/udp-domain";
import { z } from "zod";

export const UpdateNotificationPreferencesOutboundResponseWithFeatureFlagSchema =
  UpdateNotificationPreferencesOutboundResponseSchema.extend({
    featureFlags: z.object({
      newUserProfileEnabled: z.boolean(),
    }),
  });
