import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const notificationId = NonEmptyString.brand<"NotificationId">();

export type NotificationId = z.infer<typeof notificationId>;
