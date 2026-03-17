import z from "zod";

/**
 * Reference OpenAPI schema:
 *  - https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/driver-view/driver-view.json
 */

/** Shared Components */
const dateSchema = z.string().describe("Date in the format YYYY-MM-DD");

const addressSchema = z.object({
  unstructuredAddress: z
    .object({
      line1: z.string().min(1).max(45).optional(),
      line2: z.string().min(0).max(45).optional(),
      line3: z.string().min(0).max(45).optional(),
      line4: z.string().min(0).max(45).optional(),
      line5: z.string().min(0).max(45).optional(),
      postcode: z.string().optional(),
    })
    .optional(),
});

/** Driver & Licence Sub-schemas */
const driverSchema = z.object({
  drivingLicenceNumber: z.string().min(5).max(16),
  firstNames: z.string().optional(),
  lastName: z.string().optional(),
  gender: z.enum(["Male", "Female"]).optional(),
  dateOfBirth: dateSchema.optional(),
  address: addressSchema.optional(),
  disqualifiedUntil: dateSchema.optional(),
  disqualifiedForLife: z.boolean().optional(),
  disqualifiedPendingSentence: z.boolean().optional(),
});

const licenceSchema = z.object({
  type: z.enum(["Provisional", "Full"]),
  status: z.enum([
    "Valid",
    "Disqualified",
    "Revoked",
    "Surrendered",
    "Expired",
    "Exchanged",
    "Refused",
  ]),
  statusQualifier: z
    .enum([
      "For re-assessment only",
      "Photo licence invitation sent",
      "Short period disqualification",
      "Until test passed",
      "Until extended test passed",
      "Pending sentence",
      "For life",
    ])
    .optional(),
});

/** Entitlements, Endorsements, and Cards */

const entitlementRecordSchema = z.object({
  categoryCode: z.string().optional(),
  categoryLegalLiteral: z.string().optional(),
  categoryType: z.enum(["Provisional", "Full"]).optional(),
  fromDate: dateSchema.optional(),
  expiryDate: dateSchema.optional(),
  restrictions: z
    .array(
      z.object({
        restrictionCode: z.string(),
        restrictionLiteral: z.string().optional(),
      }),
    )
    .optional(),
});

const endorsementSchema = z.object({
  offenceCode: z.string().optional(),
  offenceLegalLiteral: z.string().optional(),
  offenceDate: dateSchema.optional(),
  convictionDate: dateSchema.optional(),
  penaltyPoints: z.number().int().optional(),
  penaltyPointsExpiryDate: dateSchema.optional(),
  disqualification: z
    .object({
      type: z.string().optional(),
      forLife: z.boolean().optional(),
      years: z.number().int().optional(),
      months: z.number().int().optional(),
      days: z.number().int().optional(),
      startDate: dateSchema.optional(),
      disqualifiedPendingSentence: z.boolean().optional(),
    })
    .optional(),
  disqualificationRemovalDate: dateSchema.optional(),
  disqualificationReimposedDate: dateSchema.optional(),
  disqualificationSuspendedPendingAppealDate: dateSchema.optional(),
  sentenceDate: dateSchema.optional(),
});

const tachoCardSchema = z.object({
  cardNumber: z.string().optional(),
  cardStatus: z.string().optional(),
  cardExpiryDate: dateSchema.optional(),
  cardStartOfValidityDate: dateSchema.optional(),
});

/** The Main Response Schema */
export const viewDriverResponseSchema = z.object({
  driver: driverSchema,
  licence: licenceSchema,
  entitlement: z.array(entitlementRecordSchema).optional(),
  endorsements: z.array(endorsementSchema).optional(),
  testPass: z
    .array(
      z.object({
        categoryCode: z.string().optional(),
        categoryLegalLiteral: z.string().optional(),
        testDate: dateSchema.optional(),
        status: z.string().optional(),
        withAutomaticTransmission: z.boolean().optional(),
      }),
    )
    .optional(),
  token: z
    .object({
      validFromDate: dateSchema.optional(),
      validToDate: dateSchema.optional(),
      issueNumber: z.string().optional(),
    })
    .optional(),
  cpc: z
    .object({
      cpcs: z
        .array(
          z.object({
            lgvValidTo: dateSchema.optional(),
            pcvValidTo: dateSchema.optional(),
            national: z.boolean().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  holder: z
    .object({
      tachoCards: z.array(tachoCardSchema).optional(),
    })
    .optional(),
  errors: z
    .array(
      z.object({
        status: z.string().optional(),
        code: z.string().optional(),
        detail: z.string().optional(),
      }),
    )
    .optional(),
});

export type ViewDriverResponse = z.infer<typeof viewDriverResponseSchema>;
