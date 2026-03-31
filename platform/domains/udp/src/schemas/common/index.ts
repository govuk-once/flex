import { z } from "zod";

export const consentStatusSchema = z.enum(["unknown", "accepted", "denied"]);

export const pushIdSchema = z.string().optional();

export type RequestingServiceUserIdHeader = {
  requestingServiceUserId: string;
};
