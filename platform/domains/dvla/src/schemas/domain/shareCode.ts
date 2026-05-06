import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

import { commonRequestSchema } from "../common";

export const ShareCodeSchema = z.object({
  state: z
    .enum(["cancelled", "valid"])
    .describe("The state of a share driving licence token"),

  tokenId: z.uuid({
    message: "The universally unique id for a token",
  }),

  token: z
    .string()
    .min(8)
    .max(8)
    .regex(/^[^aeilouAEIOU01]{8}$/, {
      message:
        "A driver licence share token (8 chars, excluding vowels and 0/1)",
    }),

  drivingLicenceNumber: NonEmptyString.length(16).regex(
    /^(?=.{16}$)[A-Za-z]{1,5}9{0,4}[0-9](?:[05][1-9]|[16][0-2])(?:[0][1-9]|[12][0-9]|3[01])[0-9](?:99|[A-Za-z][A-Za-z9])(?![IOQYZioqyz01_])\w[A-Za-z]{2}$/,
    {
      message: "A valid UK driving licence number",
    },
  ),

  driverId: z.uuid({
    message: "Unique identifier for a driver in the format of a V4 UUID",
  }),

  documentReference: z
    .string()
    .min(8)
    .max(8)
    .regex(/^[a-zA-Z0-9]*$/, {
      message: "A driver licence share document reference",
    }),

  created: z.iso.datetime({
    message: "The date-time the token was created",
  }),

  expiry: z.iso.datetime({
    message: "The date-time the token will expire",
  }),

  status: z.enum(["active", "inactive"]).optional(),

  redeemed: z.iso.datetime().optional(),

  cancelled: z.iso.datetime({
    message: "The date-time the token was cancelled",
  }),
});

export const SingleShareCodeResponseSchema = z.object({
  linkingId: z.uuid(),
  shareCode: ShareCodeSchema,
});

export const MultiShareCodeResponseSchema = z.object({
  linkingId: z.uuid().describe("Unique identifier linking the share request"),

  shareCodes: z
    .array(ShareCodeSchema)
    .describe("A list of share driving licence tokens"),
});

export const deleteShareCodeRequestSchema = commonRequestSchema.extend({
  shareCodeId: NonEmptyString.describe(
    "The unique identifier (tokenId) of the share code to be deleted",
  ),
});
