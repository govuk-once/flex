import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const commonRequestSchema = z.object({
  id: NonEmptyString,
  jwt: NonEmptyString,
});

export const applications_response = z
  .object({
    applications: z.array(
      z
        .object({
          applicationType: z.enum([
            "update-ordinary-licence",
            "renew-vocational-entitlement",
            "renew-photo",
            "renew-medical",
            "renewal-at-or-over-70",
            "change-address",
            "vocational-entitlement",
          ]),
          isRequired: z.boolean().nullish(),
          ineligibleReason: z
            .enum([
              "Restricted driver record found",
              "Enforcement marker found",
              "Notification of Death Date present",
              "Ongoing casework found",
              "Non-GB Resident marker found",
              "Corrupt DLN Marker found",
              "Licence inhibit found",
              "Blocked record - migration failed",
              "Vocational entitlements due to expire/expired",
              "ODL entitlements due to expire",
              "Disqualified driver",
              "Exchanged",
              "Skeleton record",
              "Non-GB record",
              "Cross-reference record",
              "Unknown record",
              "Non-licence holder",
              "Erroneous revocation marker set",
              "Licence print failure marker set",
              "Medical investigation required marker set",
              "Expired disqualification",
              "multiple ineligibility reasons",
              "Over 45 Vocational Renewal expected",
              "Under 45 Vocational Renewal expected",
              "Provisional Vocational Renewal expected",
              "Medical Vocational holder due to renew",
              "Full vocational entitlements on record",
              "Medical short period licence holder",
              "Vocational Medical short period licence holder",
              "Over 70 short period licence holder",
              "Vocational Paper licence holder",
              "Paper licence holder due to renew",
              "Photo invitation sent marker found",
              "Pre-harmonised record",
              "Medical renewal required",
              "Paper licence holder",
            ])
            .nullish(),
          availableActions: z.array(
            z
              .object({
                actionType: z.enum([
                  "update-photo",
                  "update-short-period-photo",
                  "update-short-period-photo-voc",
                  "update-address",
                  "licence-possession-declaration",
                  "eyesight-declaration",
                  "medical-declaration",
                  "organ-donation-declaration",
                  "update-signature",
                  "update-country-of-birth",
                  "inform-must-renew",
                  "inform-cant-renew",
                  "inform-should-renew",
                  "inform-could-renew",
                  "inform-paper-to-plastic",
                  "inform-surrender-c1d1-entitlement",
                  "inform-photo-exempt",
                  "inform-cannot-ren70",
                ]),
                isRequired: z.boolean().nullish(),
              })
              .loose(),
          ),
          possibleTransactions: z
            .array(
              z
                .object({
                  transactionType: z.enum([
                    "Renewal at 70",
                    "Replacement",
                    "Duplicate",
                    "Exchange Paper",
                    "Photo renewal",
                    "Photo change",
                  ]),
                  isRequired: z.boolean().nullish(),
                })
                .loose(),
            )
            .nullish(),
        })
        .loose(),
    ),
  })
  .partial();
