import { createUserId, mergeFixture } from "@flex/testing";
import type { PushId } from "@flex/udp-domain";
import { DeepPartial } from "@flex/utils";
import type { Notification, NotificationStatus } from "@schemas/notification";

export { createUserId };
export const userId = createUserId();

export const createTimestamp = (value = "2026-01-01T00:00:00Z") => value;
export const timestamp = createTimestamp();

export const createPushId = (value = "test-push-id") => value as PushId;
export const pushId = createPushId();

export const createNotificationId = (value = "test-notification-id") => value;
export const notificationId = createNotificationId();

export const createNotificationStatus = (value: NotificationStatus = "READ") =>
  value;
export const notificationStatus = createNotificationStatus();

export const createNotification = (overrides?: DeepPartial<Notification>) =>
  mergeFixture<Notification>(
    {
      NotificationID: notificationId,
      Status: notificationStatus,
      NotificationTitle: "test title",
      NotificationBody: "test body",
      DispatchedDateTime: timestamp,
      MessageTitle: "message title",
      MessageBody: "message body",
    },
    overrides,
  );
export const notification = createNotification();

export const createSecrets = (overrides?: Record<string, string>) =>
  mergeFixture(
    { udpNotificationSecret: "test-notification-secret" }, // pragma: allowlist secret
    overrides,
  );
export const secrets = createSecrets();
