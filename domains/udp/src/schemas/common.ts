import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const notificationId = NonEmptyString.brand<"NotificationId">();

// Had to re-export type from here and expose this type in exports because cross-workspace imports dont work when path aliases are used. Can figure out best way to approach this later
export type NotificationId = z.output<typeof notificationId>;
