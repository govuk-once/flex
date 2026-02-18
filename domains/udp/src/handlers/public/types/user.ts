import { CONSENT_STATUS } from "../../../schemas";

export type UserProfile = {
  notificationId: string;
  preferences: {
    notifications: {
      consentStatus: CONSENT_STATUS;
      updatedAt: string;
    };
  };
};
