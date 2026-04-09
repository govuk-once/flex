import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const commonRequestSchema = z.object({
  id: NonEmptyString,
  jwt: NonEmptyString,
});

const StructuredAddressSchema = z.object({
  language: z.string().max(256).nullable().optional(),
  country: z.string().max(256).nullable().optional(),
  dps: z.string().max(2).nullable().optional(),
  poBoxNumber: z.string().min(1).max(6).nullable().optional(),
  organisationName: z.string().min(1).max(60).nullable().optional(),
  departmentName: z.string().min(1).max(60).nullable().optional(),
  subBuildingName: z.string().min(1).max(30).nullable().optional(),
  buildingName: z.string().min(1).max(50).nullable().optional(),
  buildingNumber: z.string().min(1).max(4).nullable().optional(),
  dependentThoroughfareName: z.string().min(1).max(60).nullable().optional(),
  thoroughfareName: z.string().min(1).max(60).nullable().optional(),
  doubleDependentLocality: z.string().min(1).max(35).nullable().optional(),
  dependentLocality: z.string().min(1).max(35).nullable().optional(),
  postTown: z.string().min(1).max(30),
  postcode: z.string().max(8),
  udprn: z.string().nullable().optional(),
  uprn: z.string().nullable().optional(),
});

const UnstructuredAddressSchema = z.object({
  language: z.string().max(256).nullable().optional(),
  country: z.string().max(256).nullable().optional(),
  dps: z.string().max(2).nullable().optional(),
  line1: z.string().min(1).max(45),
  line2: z.string().max(45).nullable().optional(),
  line3: z.string().max(45).nullable().optional(),
  line4: z.string().max(45).nullable().optional(),
  line5: z.string().max(45).nullable().optional(),
  postcode: z.string().max(8),
});

export const AddressUnion = z.union([
  z.object({ structuredAddress: StructuredAddressSchema }),
  z.object({ unstructuredAddress: UnstructuredAddressSchema }),
]);

export const EligibilitySchema = z.object({
  applications: z
    .array(
      z.object({
        applicationType: z.enum([
          "update-ordinary-licence",
          "renew-vocational-entitlement",
          "renew-photo",
          "renew-medical",
          "renewal-at-or-over-70",
          "change-address",
          "vocational-entitlement",
        ]),
        isRequired: z.boolean().optional(),
        ineligibleReason: z.string().optional(),
        availableActions: z.array(
          z.object({
            actionType: z.string(),
            isRequired: z.boolean().optional(),
          }),
        ),
        possibleTransactions: z
          .array(
            z.object({
              transactionType: z.string(),
              isRequired: z.boolean().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export const TaskResponseSchema = z.object({
  tasks: z.array(
    z.object({
      applicationId: z.uuid(),
      taskId: z.uuid(),
      subjectId: z.string(),
      subjectType: z.enum(["Application", "Photo", "Signature"]),
      taskStatus: z.enum(["Active", "Completed"]),
      taskTarget: z.enum([
        "Caseworker",
        "Clerk",
        "Drivers caseworker",
        "External",
        "Supervisor",
        "Fraud",
        "Fraud review",
        "Counter service clerk",
      ]),
      taskType: z.enum([
        "CASP casework",
        "Photo review",
        "Signature review",
        "Identity evidence",
      ]),
      version: z.number().optional(),
    }),
  ),
});
