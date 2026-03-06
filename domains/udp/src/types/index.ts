import { notificationId } from "@schemas/common";
import { z } from "zod";

export type NotificationId = z.output<typeof notificationId>;
