
import { z } from "zod";

// Per-operation request schemas (what the domain sends to the gateway)
export const getIdentityRequestSchema = z.object({
    // Path param - extracted from path
    appId: z.string().min(1),
  });

  export const createUserRequestSchema = z.object({
    notificationId: z.string().min(1),
    appId: z.string().min(1),
  });

  // Remote response contract (what the remote UDP API returns)
  export const remoteIdentityResponseSchema = z.object({
    notificationId: z.string().optional(),
    preferences: z.object({
      notificationsConsented: z.boolean().optional(),
      analyticsConsented: z.boolean().optional(),
      updatedAt: z.string(),
    }).optional(),
    // ... whatever the remote actually returns
  });

  // Stable connector response (what you expose to domains)
  export const connectorIdentityResponseSchema = z.object({
    notificationId: z.string(),
    preferences: z.object({
        notifications: z.object({
            consentStatus: z.string(),
            updatedAt: z.string(),
        }),
        analytics: z.object({
            consentStatus: z.string(),
            updatedAt: z.string(),
        }),
     }),
  });
