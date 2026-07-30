import { createUserId, mergeFixture } from "@flex/testing";
import type { PushId } from "@flex/udp-domain";
import type { DeepPartial } from "@flex/utils";
import type { Group } from "@schemas/group";

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
    { Namespace: "travel", Group: "test country" },
    overrides,
  );
export const group = createGroup();

export const withSubgroup = <T extends object>(
  obj: T,
  value = "test frequency",
) => ({ ...obj, Subgroup: value });
