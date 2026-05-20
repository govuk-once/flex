import {
  AlphanumericString,
  IsoDateTime,
  NonEmptyString,
  Uuid,
} from "@flex/utils";
import { z } from "zod";

import {
  commonRequestSchema,
  DrivingLicenceNumber,
  ShareCodeToken,
} from "../common";

export const ShareCodeSchema = z
  .object({
    state: z
      .enum(["cancelled", "expired", "valid", "redeemed", "invalid"])
      .describe("The state of a share driving licence token"),
    tokenId: Uuid.describe("The universally unique id for a token"),
    token: ShareCodeToken.describe(
      "A driver licence share token (8 chars, excluding vowels and 0/1)",
    ),
    drivingLicenceNumber: DrivingLicenceNumber.describe(
      "A valid UK driving licence number",
    ),
    driverId: Uuid.describe(
      "Unique identifier for a driver in the format of a V4 UUID",
    ),
    documentReference: AlphanumericString.length(8).describe(
      "A driver licence share document reference",
    ),
    created: IsoDateTime.describe("The date-time the token was created"),
    expiry: IsoDateTime.describe("The date-time the token will expire"),
    status: z.enum(["active", "inactive"]).nullish(),
    redeemed: IsoDateTime.nullish(),
    cancelled: IsoDateTime.describe(
      "The date-time the token was cancelled",
    ).nullish(),
  })
  .meta({ id: "ShareCode" });

export const SingleShareCodeResponseSchema = z
  .object({ linkingId: Uuid, shareCode: ShareCodeSchema })
  .meta({ id: "SingleShareCodeResponse" });

export const MultiShareCodeResponseSchema = z
  .object({
    linkingId: Uuid.describe("Unique identifier linking the share request"),
    shareCodes: z
      .array(ShareCodeSchema)
      .describe("A list of share driving licence tokens"),
  })
  .meta({ id: "MultiShareCodeResponse" });

export const postShareCodeCancelRequestSchema = commonRequestSchema.extend({
  shareCodeId: NonEmptyString.describe(
    "The unique identifier (tokenId) of the share code to be deleted",
  ),
});
