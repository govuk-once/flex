import { z } from "zod";

export const RemoteCreateUserSchema = z.object();

export const RemoteAnalyticsConsentSchema = z.object({
  consentStatus: z.string(),
  updatedAt: z.string(),
});

export type RemoteUserContract = {
  createUser: {
    params: { user_id: string };
    body: never;
    response: z.infer<typeof RemoteCreateUserSchema>;
  };
};
