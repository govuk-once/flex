import { createUserId, mergeFixture } from "@flex/testing";
import type { DeepPartial } from "@flex/utils";
import type {
  ServiceIdentityLink,
  ServiceIdentityLinkRequest,
} from "@schemas/identity";
import type {
  ConsentStatus,
  Notification,
  PushId,
} from "@schemas/notifications";
import type { UserProfile } from "@schemas/user";

export { createUserId };
export const userId = createUserId("test-udp-user");

export const createSecrets = (overrides?: Record<string, string>) =>
  mergeFixture(
    { udpNotificationSecret: "test-notification-secret" }, // pragma: allowlist secret
    overrides,
  );
export const secrets = createSecrets();

export const createPushId = (id = "test-push-id") => id as PushId;
export const pushId = createPushId();

export const createServiceId = (value = "test-service-id") => value;
export const serviceId = createServiceId();

export const createServiceName = (value = "test-service-name") => value;
export const serviceName = createServiceName();

export const createConsentStatus = (value: ConsentStatus = "unknown") => value;
export const consentStatus = createConsentStatus();

export const createServiceIdentityLink = (
  overrides?: DeepPartial<ServiceIdentityLink>,
) => mergeFixture<ServiceIdentityLink>({ serviceId, serviceName }, overrides);
export const serviceIdentityLink = createServiceIdentityLink();

export const createServiceIdentityRequest = (
  overrides?: DeepPartial<ServiceIdentityLinkRequest>,
) => mergeFixture<ServiceIdentityLinkRequest>({ appId: userId }, overrides);
export const serviceIdentityLinkRequest = createServiceIdentityRequest();

export const createNotification = (overrides?: DeepPartial<Notification>) =>
  mergeFixture<Notification>({ consentStatus, pushId }, overrides);
export const notification = createNotification();

export const createUserProfile = (overrides?: DeepPartial<UserProfile>) =>
  mergeFixture<UserProfile>({ userId, pushId }, overrides);
export const userProfile = createUserProfile();
