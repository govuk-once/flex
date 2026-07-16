import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

import { commonRequestSchema, DrivingLicenceNumber } from "../common";

const BaseShareCodeSchema = z.object({
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

  drivingLicenceNumber: DrivingLicenceNumber.describe(
    "A valid UK driving licence number",
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

  status: z
    .string()
    .nullish()
    .describe("The current status of a driving licence share token"),

  redeemed: z.iso.datetime().nullish(),
});

export const ShareCodeSchema = z
  .discriminatedUnion("state", [
    BaseShareCodeSchema.extend({
      state: z
        .literal("valid")
        .describe("The state of an active share driving licence token"),
      cancelled: z.iso.datetime().nullish(),
    }),

    BaseShareCodeSchema.extend({
      state: z
        .literal("cancelled")
        .describe("The state of a cancelled share driving licence token"),
      cancelled: z.iso.datetime({
        message: "The date-time the token was cancelled",
      }),
    }),

    BaseShareCodeSchema.extend({
      state: z
        .enum(["expired", "redeemed", "invalid"])
        .describe("Other token states"),
      cancelled: z.iso.datetime().nullish(),
    }),
  ])
  .meta({ id: "ShareCode" });

export const SingleShareCodeResponseSchemaWithoutIdSchema =
  ShareCodeSchema.meta({ id: "SingleShareCodeResponseWithoutId" });

export const SingleShareCodeResponseSchema = ShareCodeSchema.meta({
  id: "SingleShareCodeResponse",
});

export const postShareCodeCancelRequestSchema = commonRequestSchema.extend({
  shareCodeId: NonEmptyString.describe(
    "The unique identifier (tokenId) of the share code to be deleted",
  ),
});
