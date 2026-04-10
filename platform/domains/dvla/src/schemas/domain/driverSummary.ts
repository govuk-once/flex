import z from "zod";

import { applications_response } from "../common";

const holder_by_driving_licence_number = z.object({
  driver: z
    .object({
      drivingLicenceNumber: z
        .string()
        .min(5)
        .max(16)
        .regex(/^[a-zA-Z0-9]*$/),
      firstNames: z.string().nullish(),
      lastName: z.string().nullish(),
      title: z.string().nullish(),
      nameFormat: z.unknown().nullish(),
      fullModeOfAddress: z.string().nullish(),
      gender: z.enum(["Male", "Female"]).nullish(),
      dateOfBirth: z.string().nullish(),
      placeOfBirth: z.string().nullish(),
      address: z
        .object({
          unstructuredAddress: z
            .object({
              language: z.string().max(256).nullish(),
              country: z.string().max(256).nullish(),
              dps: z.string().max(2).nullish(),
              line1: z.string().max(45).nullish(),
              line2: z.string().max(45).nullish(),
              line3: z.string().max(45).nullish(),
              line4: z.string().max(45).nullish(),
              line5: z.string().max(45).nullish(),
              postcode: z.string().max(8).nullish(),
            })
            .partial(),
        })
        .nullish(),
      disqualifiedUntil: z.string().nullish(),
      disqualifiedForLife: z.boolean().nullish(),
      deathNotificationDate: z.string().nullish(),
      disqualifiedPendingSentence: z.boolean().nullish(),
      eyesight: z
        .enum([
          "Meets eyesight standard",
          "Meets higher eyesight standard",
          "Needs glasses/corrective lenses",
          "Needs glasses/corrective lenses for higher eyesight standard only",
        ])
        .nullish(),
      hearing: z
        .enum([
          "Profoundly deaf",
          "Able to communicate",
          "Profoundly deaf, able to communicate",
        ])
        .nullish(),
      imagesExist: z.boolean().nullish(),
      isMilitary: z.boolean().nullish(),
      approvedDrivingInstructor: z.boolean().nullish(),
      retainedC1_D1Entitlement: z.boolean().nullish(),
      previousDrivingLicence: z
        .array(
          z.object({
            previousDrivingLicenceNumber: z.string(),
            previousLastName: z.string().nullish(),
            previousFirstNames: z.string().nullish(),
            previousDateOfBirth: z.string().nullish(),
          }),
        )
        .nullish(),
      dateRevokedUntilTestPassed: z.string().nullish(),
      penaltyPoints: z.number().nullish(),
      numberOfOffences: z.number().nullish(),
    })
    .loose(),
  licence: z
    .object({
      type: z.enum(["Provisional", "Full"]).nullish(),
      status: z
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
        .nullish(),
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
        .nullish(),
      countryToWhichExchanged: z.string().nullish(),
    })
    .nullish(),
  entitlement: z
    .array(
      z
        .object({
          categoryCode: z.string().nullish(),
          categoryLegalLiteral: z.string().nullish(),
          welshCategoryLegalLiteral: z.string().nullish(),
          categoryShortLiteral: z.string().nullish(),
          welshCategoryShortLiteral: z.string().nullish(),
          categoryType: z.enum(["Provisional", "Full"]).nullish(),
          fromDate: z.string().nullish(),
          fromDateIsPriorTo: z.boolean().nullish(),
          expiryDate: z.string().nullish(),
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
            .nullish(),
          restrictions: z
            .array(
              z.object({
                restrictionCode: z.string().nullish(),
                restrictionLiteral: z.string().nullish(),
                welshRestrictionLiteral: z.string().nullish(),
              }),
            )
            .nullish(),
          restrictedToAutomaticTransmission: z.boolean().nullish(),
          fromNonGB: z.boolean().nullish(),
        })
        .partial(),
    )
    .nullish(),
  testPass: z
    .array(
      z
        .object({
          type: z
            .enum([
              "Driving Licence",
              "Certificate of Professional Competency",
              "CBT",
            ])
            .nullish(),
          categoryCode: z.string().nullish(),
          categoryLegalLiteral: z.string().nullish(),
          categoryShortLiteral: z.string().nullish(),
          testDate: z.string().nullish(),
          expiryDate: z.string().nullish(),
          status: z.enum(["Claimed", "Cancelled", "Unclaimed"]).nullish(),
          withAutomaticTransmission: z.boolean().nullish(),
          vehicleAdaptations: z.array(z.string()).nullish(),
          restrictions: z
            .array(
              z.object({
                restrictionCode: z.string().nullish(),
                restrictionLiteral: z.string().nullish(),
                welshRestrictionLiteral: z.string().nullish(),
              }),
            )
            .nullish(),
          withTrailer: z.boolean().nullish(),
          extendedTest: z.boolean().nullish(),
          licenceSurrendered: z.boolean().nullish(),
          testingAuthority: z.string().nullish(),
        })
        .partial(),
    )
    .nullish(),
  endorsements: z
    .array(
      z
        .object({
          appealCourtCode: z
            .string()
            .regex(/[0-9]{4}/)
            .nullish(),
          appealCourtName: z.string().nullish(),
          appealDate: z.string().nullish(),
          convictionDate: z.string().nullish(),
          convictionCourtCode: z
            .string()
            .regex(/[0-9]{4}/)
            .nullish(),
          convictionCourtName: z.string().nullish(),
          disqualification: z
            .object({
              type: z.enum([
                "Disqualified until Test Pass",
                "Disqualified until Extended Test Pass",
                "Revoked until Test Pass",
                "Revoked test passed",
                "Extended test passed",
                "Test passed",
                "Appeal against Revocation until Test Pass",
                "Appeal against Disqualification until Extended Test Pass",
                "Appeal against Disqualification until Test Pass",
              ]),
              forLife: z.boolean(),
              years: z.number().int(),
              months: z.number().int(),
              days: z.number().int(),
              startDate: z.string(),
            })
            .partial()
            .nullish(),
          disqualificationSuspendedPendingAppealDate: z.string().nullish(),
          disqualificationReimposedDate: z.string().nullish(),
          disqualificationRemovalDate: z.string().nullish(),
          disqualifiedPendingSentence: z.string().nullish(),
          expiryDate: z.string().nullish(),
          fine: z.number().nullish(),
          fromDate: z.string().nullish(),
          identifier: z.string().nullish(),
          intoxicant: z
            .object({
              intoxicantType: z.string(),
              testingMethod: z.string(),
              level: z.number(),
            })
            .partial()
            .nullish(),
          markers: z.object({ declaredHardship: z.boolean() }).nullish(),
          nextReportDate: z.string().nullish(),
          notificationSource: z.string().nullish(),
          offenceCode: z.string().nullish(),
          offenceLegalLiteral: z.string().nullish(),
          welshOffenceLegalLiteral: z.string().nullish(),
          offenceDate: z.string().nullish(),
          otherSentence: z.string().nullish(),
          otherSentenceLiteral: z.string().nullish(),
          welshOtherSentenceLiteral: z.string().nullish(),
          penaltyPoints: z.number().int().nullish(),
          penaltyPointsExpiryDate: z.string().nullish(),
          prisonSentSuspendedPeriod: z
            .object({
              years: z.number().int(),
              months: z.number().int(),
              days: z.number().int(),
              hours: z.number().int(),
            })
            .partial()
            .nullish(),
          rehabilitationCourseCompleted: z.boolean().nullish(),
          sentenceDate: z.string().nullish(),
          sentencingCourtCode: z
            .string()
            .regex(/[0-9]{4}/)
            .nullish(),
          sentencingCourtName: z.string().nullish(),
        })
        .optional(),
    )
    .nullish(),
  token: z
    .object({
      type: z.enum(["Driving Licence", "Drivers Qualification Card"]).nullish(),
      drivingLicenceNumber: z.string().max(16).nullish(),
      issueNumber: z.string().nullish(),
      validFromDate: z.string().nullish(),
      validToDate: z.string().nullish(),
      isProvisional: z.boolean().nullish(),
      entitlements: z
        .array(
          z
            .object({
              category: z.string().nullish(),
              categoryLegalLiteral: z.string().nullish(),
              categoryShortLiteral: z.string().nullish(),
              categoryType: z.enum(["Provisional", "Full"]).nullish(),
              categoryFromDate: z.string().nullish(),
              categoryFromDateIsPriorTo: z.boolean().nullish(),
              categoryExpiryDate: z.string().nullish(),
              categoryRestrictions: z
                .array(
                  z.object({
                    categoryRestrictionCode: z.string().nullish(),
                    categoryRestrictionLiteral: z.string().nullish(),
                    welshCategoryRestrictionLiteral: z.string().nullish(),
                  }),
                )
                .nullish(),
              group: z.string().nullish(),
              groupShortLiteral: z.string().nullish(),
              groupLegalLiteral: z.string().nullish(),
              groupType: z.enum(["Provisional", "Full"]).nullish(),
              groupFromDate: z.string().nullish(),
              groupFromDateIsPrior: z.boolean().nullish(),
              groupExpiryDate: z.string().nullish(),
              groupRestrictions: z
                .array(
                  z.object({
                    groupRestrictionCode: z.string().nullish(),
                    groupRestrictionLiteral: z.string().nullish(),
                    welshGroupRestrictionLiteral: z.string().nullish(),
                  }),
                )
                .nullish(),
            })
            .partial(),
        )
        .nullish(),
    })
    .partial()
    .nullish(),
  holder: z
    .object({
      holderFirstNames: z.string().nullish(),
      holderSurname: z.string().nullish(),
      holderAddress: z
        .object({
          structuredAddress: z
            .object({
              structuredAddress: z
                .object({
                  postTown: z.string().nullish(),
                  postcode: z.string().nullish(),
                })
                .partial()
                .loose()
                .nullish(),
            })
            .partial()
            .loose()
            .nullish(),
          unstructuredAddress: z
            .object({
              unstructuredAddress: z
                .object({
                  line1: z.string().nullish(),
                  postcode: z.string().nullish(),
                  mailsort: z.string().nullish(),
                  bfpoNumber: z.string().nullish(),
                })
                .partial()
                .loose()
                .nullish(),
            })
            .partial()
            .loose()
            .nullish(),
        })
        .partial()
        .loose()
        .nullish(),
      holderDateOfBirth: z.string().nullish(),
      holderDrivingLicenceNumber: z.string().max(16).nullish(),
      holderDrivingLicenceIssuingNation: z.string().nullish(),
      tachoCards: z
        .array(
          z
            .object({
              cardType: z.enum(["DRIVER", "WORKSHOP"]).nullish(),
              cardNumber: z.string().nullish(),
              cardIssueDate: z.string().nullish(),
              workshopName: z.string().nullish(),
              workshopNumber: z.string().nullish(),
              workshopAddress: z
                .union([
                  z.object({ structuredAddress: z.any() }),
                  z.object({ unstructuredAddress: z.any() }),
                ])
                .nullish(),
            })
            .partial(),
        )
        .nullish(),
    })
    .partial()
    .nullish(),
});

const find_tokens = z
  .object({
    tokens: z.array(
      z.object({
        state: z.enum(["cancelled", "expired", "redeemed", "valid", "invalid"]),
        tokenId: z.uuid(),
        token: z
          .string()
          .min(8)
          .max(8)
          .regex(/^[^aeilouAEIOU01]{8}$/),
        drivingLicenceNumber: z
          .string()
          .min(16)
          .max(16)
          .regex(
            /^(?=.{16}$)[A-Za-z]{1,5}9{0,4}[0-9](?:[05][1-9]|[16][0-2])(?:[0][1-9]|[12][0-9]|3[01])[0-9](?:99|[A-Za-z][A-Za-z9])(?![IOQYZioqyz01_])\w[A-Za-z]{2}/,
          ),
        driverId: z.uuid(),
        documentReference: z
          .string()
          .min(8)
          .max(8)
          .regex(/^[a-zA-Z0-9]*$/),
        created: z.iso.datetime({ offset: true }),
        expiry: z.iso.datetime({ offset: true }),
        status: z.enum(["active", "inactive"]).nullish(),
        redeemed: z.iso.datetime({ offset: true }).nullish(),
        cancelled: z.iso.datetime({ offset: true }).nullish(),
      }),
    ),
  })
  .loose();

export const RetrieveDriverSummaryByLinkingIdResponse = z
  .object({
    linkingId: z.uuid(),
    driverViewResponse: holder_by_driving_licence_number,
    sdlResponse: find_tokens.nullish(),
    driversEligibilityResponse: applications_response.nullish(),
    imageUtilityResponse: z
      .object({ photoUrl: z.string(), signatureImageUrl: z.string() })
      .partial()
      .loose()
      .nullish(),
    hasErrors: z.boolean(),
  })
  .loose();
