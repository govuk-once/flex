import { z } from "zod";

export const consentStatusSchema = z.enum(["unknown", "accepted", "denied"]);

export const notificationIdSchema = z.string().optional();
