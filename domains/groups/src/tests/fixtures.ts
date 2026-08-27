import { createUserId, mergeFixture } from "@flex/testing";
import type { PushId } from "@flex/udp-domain";
import type { DeepPartial } from "@flex/utils";
import {
  type Group,
  type GroupSubscription,
  GroupTypeSchema,
} from "@schemas/group";

export { createUserId };

export const userId = createUserId("test-uns-user");

export const createPushId = (value = "test-push-id") => value as PushId;
export const pushId = createPushId();

export const createSecrets = (overrides?: Record<string, string>) =>
  mergeFixture(
    { udpNotificationSecret: "test-notification-secret" }, // pragma: allowlist secret
    overrides,
  );

export const secrets = createSecrets();

export const createGroup = (overrides?: DeepPartial<Group>) =>
  mergeFixture<Group>(
    {
      Namespace: "travel",
      Group: "test country",
    },
    overrides,
  );

export const group = createGroup();

export const withSubgroup = <T extends object>(
  obj: T,
  value = "test frequency",
) => ({
  ...obj,
  Subgroup: value,
});

export const createGroupSubscription = (
  overrides?: DeepPartial<GroupSubscription>,
) =>
  mergeFixture<GroupSubscription>(
    {
      ...createGroup(),
      Type: GroupTypeSchema.enum.NOTIFICATION,
    },
    overrides,
  );

export const groupSubscription = createGroupSubscription();

export const groupSubscriptionWithSubgroup = createGroupSubscription({
  Subgroup: "test frequency",
});

export const groupSubscriptions = [
  groupSubscription,
  groupSubscriptionWithSubgroup,
];
