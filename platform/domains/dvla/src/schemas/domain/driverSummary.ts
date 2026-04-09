import z from "zod";

import { EligibilitySchema } from "../common";

const EndorsementSchema = z.object({
  convictionCourtCode: z.string(),
  expiryDate: z.string(),
  fromDate: z.string(),
  offenceCode: z.string(),
  penaltyPoints: z.number().optional(),
  offenceDate: z.string().optional(),
});

const TokenSchema = z.object({
  tokenId: z.uuid(),
  token: z.string(),
  drivingLicenceNumber: z.string(),
  state: z.enum(["cancelled", "expired", "redeemed", "valid", "invalid"]),
  expiry: z.string(),
});

export const RetrieveDriverSummaryByLinkingIdResponse = z.object({
  linkingId: z.uuid(),
  hasErrors: z.boolean(),
  driverViewResponse: z.object({
    driver: z.object({
      drivingLicenceNumber: z.string(),
      lastName: z.string().optional(),
      firstNames: z.string().optional(),
      dateOfBirth: z.string().optional(),
    }),
    licence: z.object({
      type: z.enum(["Provisional", "Full"]),
      status: z.string(),
    }),
    entitlement: z.array(
      z.object({
        categoryCode: z.string(),
        categoryType: z.enum(["Provisional", "Full"]),
        categoryStatus: z.string(),
        fromDate: z.string().optional(),
        expiryDate: z.string().optional(),
      }),
    ),
    testPass: z.array(
      z.object({
        type: z.enum([
          "Driving Licence",
          "Certificate of Professional Competency",
          "CBT",
        ]),
        testDate: z.string(),
        categoryCode: z.string().optional(),
      }),
    ),
    endorsements: z.array(EndorsementSchema),
  }),
  sdlResponse: z
    .object({
      tokens: z.array(TokenSchema),
    })
    .optional(),
  driversEligibilityResponse: EligibilitySchema.optional(),
  imageUtilityResponse: z
    .object({
      photoUrl: z.string().optional(),
      signatureImageUrl: z.string().optional(),
    })
    .optional(),
});
