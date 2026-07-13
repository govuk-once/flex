import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

import { commonRequestSchema, DrivingLicenceNumber } from "../common";

export const ShareCodeSchema = z
  .object({
    state: z
      .enum(["cancelled", "expired", "valid", "redeemed", "invalid"])
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

    status: z.enum(["active", "inactive"]).nullish(),

    redeemed: z.iso.datetime().nullish(),

    cancelled: z.iso
      .datetime({
        message: "The date-time the token was cancelled",
      })
      .nullish(),
  })
  .meta({ id: "ShareCode" });

export const SingleShareCodeResponseSchemaWithoutIdSchema = z
  .object({
    shareCode: ShareCodeSchema,
  })
  .meta({ id: "SingleShareCodeResponseWithoutId" });

export const SingleShareCodeResponseSchema =
  SingleShareCodeResponseSchemaWithoutIdSchema.extend({
    linkingId: z.uuid(),
  }).meta({ id: "SingleShareCodeResponse" });

export const postShareCodeCancelRequestSchema = commonRequestSchema.extend({
  shareCodeId: NonEmptyString.describe(
    "The unique identifier (tokenId) of the share code to be deleted",
  ),
});
