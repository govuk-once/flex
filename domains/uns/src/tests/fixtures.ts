import { createUserId, mergeFixture, timestamp } from "@flex/testing";
import type { PushId } from "@flex/udp-domain";
import type { DeepPartial } from "@flex/utils";
import type { Notification, NotificationStatus } from "@schemas/notification";

export { createUserId };
export const userId = createUserId("test-uns-user");

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
      Metadata: {
        Sender: {
          DisplayName: "UNS",
        },
      },
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
