import { z } from "zod";

// ---------------------------------------------------------
// 1. Endorsement Sub-schemas
// ---------------------------------------------------------

const disqualificationSchema = z.object({
  type: z
    .enum([
      "Disqualified until Test Pass",
      "Disqualified until Extended Test Pass",
      "Revoked until Test Pass",
      "Revoked test passed",
      "Extended test passed",
      "Test passed",
      "Appeal against Revocation until Test Pass",
      "Appeal against Disqualification until Extended Test Pass",
      "Appeal against Disqualification until Test Pass",
    ])
    .optional()
    .describe("The type of the disqualification"),
  forLife: z
    .boolean()
    .optional()
    .describe("Whether the disqualification is for life"),
  years: z
    .number()
    .int()
    .optional()
    .describe("The number of years the disqualification applies for"),
  months: z
    .number()
    .int()
    .optional()
    .describe("The number of months the disqualification applies for"),
  days: z
    .number()
    .int()
    .optional()
    .describe("The number of days the disqualification applies for"),
  startDate: z
    .string()
    .optional()
    .describe("The date from which the disqualification applies"),
});

const intoxicantSchema = z.object({
  intoxicantType: z.string().optional().describe("The type of intoxicant"),
  testingMethod: z
    .string()
    .optional()
    .describe("The method of testing for the intoxicant"),
  level: z.number().optional().describe("The level of the intoxicant detected"),
});

const markersSchema = z.object({
  declaredHardship: z
    .boolean()
    .describe(
      "Indicates hardship was claimed in the court case preventing automatic disqualification",
    ),
});

const prisonSentSuspendedPeriodSchema = z.object({
  years: z
    .number()
    .int()
    .optional()
    .describe("The number of years the sentence is suspended for"),
  months: z
    .number()
    .int()
    .optional()
    .describe("The number of months the sentence is suspended for"),
  days: z
    .number()
    .int()
    .optional()
    .describe("The number of days the sentence is suspended for"),
  hours: z
    .number()
    .int()
    .optional()
    .describe("The number of hours the sentence is suspended for"),
});

const endorsementSchema = z.object({
  appealCourtCode: z
    .string()
    .regex(/^[0-9]{4}$/)
    .optional()
    .describe("A court-code object holding details of the appeal court"),
  appealCourtName: z
    .string()
    .optional()
    .describe(
      "The name of the court at which the driver's appeal hearing was held",
    ),
  appealDate: z
    .string()
    .optional()
    .describe("Date on which the appeal to the conviction was heard"),
  convictionDate: z.string().optional().describe("The date of the conviction"),
  convictionCourtCode: z
    .string()
    .regex(/^[0-9]{4}$/)
    .describe(
      "A court-code object holding details of the court the driver was convicted at",
    ),
  convictionCourtName: z
    .string()
    .optional()
    .describe("The name of the court at which the driver was convicted"),
  disqualification: disqualificationSchema
    .optional()
    .describe(
      "A disqualification object holding details of the disqualification",
    ),
  disqualificationSuspendedPendingAppealDate: z
    .string()
    .optional()
    .describe(
      "Date on which the disqualification was suspended pending the appeal",
    ),
  disqualificationReimposedDate: z
    .string()
    .optional()
    .describe(
      "The date on which the disqualification was reimposed after appeal",
    ),
  disqualificationRemovalDate: z
    .string()
    .optional()
    .describe("Date on which the disqualification was removed"),
  disqualifiedPendingSentence: z
    .string()
    .optional()
    .describe("Indicates if the holder is disqualified pending sentencing"),
  expiryDate: z.string().describe("The date the endorsement will expire"),
  fine: z.number().optional().describe("The fine imposed"),
  fromDate: z.string().describe("The date the endorsement applies from"),
  identifier: z
    .string()
    .optional()
    .describe("The identifier for the endorsement"),
  intoxicant: intoxicantSchema
    .optional()
    .describe("An intoxicant object holding details of the intoxicant taken"),
  markers: markersSchema
    .optional()
    .describe("A markers object holding details of an markers"),
  nextReportDate: z
    .string()
    .optional()
    .describe("The date the next report is due"),
  notificationSource: z
    .string()
    .optional()
    .describe("Who notified the DVLA of the endorsement"),
  offenceCode: z
    .string()
    .describe("The code of the offence causing the endorsement"),
  offenceLegalLiteral: z
    .string()
    .optional()
    .describe("The literal descriptor of offence code"),
  welshOffenceLegalLiteral: z
    .string()
    .optional()
    .describe("The literal descriptor of offence code in Welsh"),
  offenceDate: z
    .string()
    .optional()
    .describe("The date the offence was committed"),
  otherSentence: z
    .string()
    .optional()
    .describe("Non Custodial or financial sentence type"),
  otherSentenceLiteral: z
    .string()
    .optional()
    .describe(
      "English description of the custodial or non-financial sentence issued by the courts service",
    ),
  welshOtherSentenceLiteral: z
    .string()
    .optional()
    .describe(
      "Welsh description of the custodial or non-financial sentence issued by the courts service",
    ),
  penaltyPoints: z
    .number()
    .int()
    .optional()
    .describe("The number of penalty points given"),
  penaltyPointsExpiryDate: z
    .string()
    .optional()
    .describe("The date the penalty points expire"),
  prisonSentSuspendedPeriod: prisonSentSuspendedPeriodSchema.optional(),
  rehabilitationCourseCompleted: z
    .boolean()
    .optional()
    .describe("Indicates if a rehabilitation course has been completed"),
  sentenceDate: z
    .string()
    .optional()
    .describe(
      "The date of sentencing for the offence that led to the endorsement",
    ),
  sentencingCourtCode: z
    .string()
    .regex(/^[0-9]{4}$/)
    .optional()
    .describe(
      "A court-code object holding details of the court the driver was sentenced at",
    ),
  sentencingCourtName: z
    .string()
    .optional()
    .describe("The name of the court at which the driver was sentenced"),
});

// ---------------------------------------------------------
// 2. Entitlement Sub-schemas
// ---------------------------------------------------------

const restrictionSchema = z.object({
  restrictionCode: z.string().describe("DVLA restriction reference code"),
  restrictionLiteral: z
    .string()
    .optional()
    .describe("DVLA descriptive restriction literal"),
  welshRestrictionLiteral: z
    .string()
    .optional()
    .describe("DVLA descriptive restriction literal in welsh"),
});

const entitlementSchema = z.object({
  categoryCode: z.string().describe("Licence category code"),
  categoryLegalLiteral: z
    .string()
    .optional()
    .describe("The full legal literal for the category code"),
  welshCategoryLegalLiteral: z
    .string()
    .optional()
    .describe("The full legal literal for the category code in Welsh"),
  categoryShortLiteral: z
    .string()
    .optional()
    .describe("The short literal for the category code"),
  welshCategoryShortLiteral: z
    .string()
    .optional()
    .describe("The short literal for the category code in Welsh"),
  categoryType: z
    .enum(["Provisional", "Full"])
    .describe("The entitlement category type"),
  fromDate: z
    .string()
    .optional()
    .describe("The date the entitlement applies from"),
  fromDateIsPriorTo: z
    .boolean()
    .optional()
    .describe(
      "Given a driver with one or more entitlements issued prior to the existence of the DVLA",
    ),
  expiryDate: z
    .string()
    .optional()
    .describe("The date the entitlement expires"),
  categoryStatus: z
    .enum([
      "Valid",
      "Revoked",
      "Revoked until Test Pass",
      "Revoked for medical reasons",
      "Expired",
      "Surrendered",
      "Disqualified",
      "Disqualified until Test Pass",
      "Disqualified until Extended Test Pass",
      "Suspended",
      "Lapsed",
      "Refused",
      "Refused for medical reasons",
    ])
    .describe("The status of the entitlement category"),
  restrictions: z
    .array(restrictionSchema)
    .optional()
    .describe("The restrictions that apply to the entitlements"),
  restrictedToAutomaticTransmission: z
    .boolean()
    .optional()
    .describe(
      "Indicates if the entitlement only applies to cars with automatic transmission",
    ),
  fromNonGB: z
    .boolean()
    .optional()
    .describe(
      "Indicates if the category was assigned based on the entitlement from a non-GB licence during exchange",
    ),
});

// ---------------------------------------------------------
// 3. Share Tokens Sub-schemas
// ---------------------------------------------------------

const shareTokenSchema = z.object({
  state: z
    .enum(["cancelled", "expired", "redeemed", "valid", "invalid"])
    .describe("The state of a share driving licence token"),

  tokenId: z.uuid().describe("The universally unique id for a token"),

  token: z
    .string()
    .length(8)
    .regex(/^[^aeilouAEIOU01]{8}$/)
    .describe("A driver licence share token"),

  drivingLicenceNumber: z
    .string()
    .length(16)
    .regex(
      /^[A-Za-z]{1,5}9{0,4}\d(?:[05][1-9]|[16][0-2])(?:0[1-9]|[12]\d|3[01])\d(?:99|[A-Za-z][A-Za-z9])(?![IOQYZioqyz01_])\w[A-Za-z]{2}$/,
    )
    .describe("A UK driving licence number"),

  driverId: z
    .uuid()
    .describe("Unique identifier for a driver in the format of a V4 UUID."),

  documentReference: z
    .string()
    .length(8)
    .regex(/^[a-zA-Z0-9]*$/)
    .describe("A driver licence share document reference"),

  // Using .datetime() for standard ISO 8601 validation
  created: z.iso
    .datetime()
    .describe(
      "The date-time the token was created in YYYY-MM-DDTHH-mm-SS.mmmZ format",
    ),
  expiry: z.iso
    .datetime()
    .describe(
      "The date-time the token will expire in YYYY-MM-DDTHH-mm-SS.mmmZ format",
    ),

  status: z
    .enum(["active", "inactive"])
    .optional()
    .describe("The current status of a driving licence share token"),

  redeemed: z.iso
    .datetime()
    .optional()
    .describe(
      "The date-time the token was redeemed in YYYY-MM-DDTHH-mm-SS.mmmZ format",
    ),
  cancelled: z.iso
    .datetime()
    .optional()
    .describe(
      "The date-time the token was cancelled in YYYY-MM-DDTHH-mm-SS.mmmZ format",
    ),
});

// ---------------------------------------------------------
// 4. Main Customer Driver's Licence Schema
// ---------------------------------------------------------

export const customerDriversLicenceSchema = z
  .object({
    licenceType: z.enum(["Provisional", "Full"]).describe("The licence type"),

    drivingLicenceNumber: z
      .string()
      .min(5)
      .max(16)
      .regex(/^[a-zA-Z0-9]*$/)
      .describe("A UK driving licence number"),

    driverTitle: z
      .string()
      .optional()
      .describe("Title in full mode of address, e.g. Mr, Miss, Lord"),
    driverFirstNames: z
      .string()
      .optional()
      .describe("The first name(s) of the driver"),
    driverLastName: z
      .string()
      .optional()
      .describe("The last name of the driver"),
    driverFullAddress: z
      .string()
      .optional()
      .describe(
        String.raw`Driver full address in a single string with the format "line1\nline2\nline3\nline4\nline5\npostcode"`,
      ),
    tokenValidToDate: z
      .string()
      .optional()
      .describe("The date the token is valid to"),

    endorsements: z
      .array(endorsementSchema)
      .optional()
      .describe("All endorsements against the driver"),

    licenceStatus: z
      .enum([
        "Valid",
        "Disqualified",
        "Revoked",
        "Revoked for medical reasons",
        "Surrendered",
        "Surrendered voluntarily",
        "Surrendered for medical reasons",
        "Expired",
        "Exchanged",
        "Refused",
        "Refused for medical reasons",
      ])
      .optional()
      .describe("The current activation state of the licence"),

    entitlements: z
      .array(entitlementSchema)
      .optional()
      .describe("All of the entitlements the driver has"),

    shareCodes: z
      .array(shareTokenSchema)
      .optional()
      .describe("All tokens found matching the criteria"),
  })
  .describe("GovUK App Customer Driver's Licence");
