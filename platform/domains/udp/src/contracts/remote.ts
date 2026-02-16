import { z } from "zod";

/**
 * Remote contract schemas — what the external UDP API returns.
 * Private to the gateway package only. Domain services NEVER import from here.
 */

export const RemoteConsentDataSchema = z.object({
  consentStatus: z.string(),
  updatedAt: z.string(),
});

export const RemoteConsentResponseSchema = z.union([
  z.object({ data: RemoteConsentDataSchema }),
  RemoteConsentDataSchema,
]);

/** Response from GET notifications/analytics — consent data */
export type RemoteConsentResponse = z.infer<typeof RemoteConsentResponseSchema>;

/**
 * Remote contract registry — operations the gateway can perform on the UDP API.
 * Each ACL Lambda owns its own RemoteContractRegistry.
 */
export type UdpRemoteContract = {
  getNotifications: {
    params: never;
    body: never;
    response: RemoteConsentResponse;
    requiresHeaders: true;
  };
  postNotifications: {
    params: never;
    body: { data: { consentStatus: string; updatedAt: string } };
    response: never;
    requiresHeaders: true;
  };
  postUser: {
    params: never;
    body: { notificationId: string; appId: string };
    response: never;
    requiresHeaders: false;
  };
};
