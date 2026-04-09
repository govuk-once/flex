import z from "zod";

import { AddressUnion, EligibilitySchema, TaskResponseSchema } from "../common";

const VehicleFullResponseSchema = z.object({
  registrationNumber: z.string(),
  recordType: z
    .enum([
      "Full Main",
      "Retained",
      "Void",
      "CT Void",
      "MOD Void",
      "BFG Void",
      "CT Pending",
      "Fat Skeleton",
    ])
    .optional(),
  vehicleId: z.number(),
  chassisVin: z.string(),
  make: z.string(),
  model: z.string(),
  fuelType: z.string().optional(),
  taxStatus: z
    .enum(["Not Taxed for on Road Use", "SORN", "Untaxed", "Taxed"])
    .optional(),
  motStatus: z.string(),
  colour: z.string(),
  numberOfPreviousKeepers: z.number(),
  taxRates: z
    .array(
      z.object({
        description: z.string().optional(),
        vedBand: z.string().optional(),
        rate12Months: z.number().optional(),
        rate06Months: z.number().optional(),
        hasError: z.boolean().optional(),
      }),
    )
    .optional(),
});

const ProductSchema = z.object({
  productType: z.enum(["Driving Licence", "Vehicle"]),
  productKey: z.string(),
  productIdentifier: z.string(),
  productSummary: z.union([
    z.object({
      licenceExpiryDate: z.string().optional(),
      licenceType: z.enum(["Full", "Provisional"]),
      licenceStatus: z.string(),
    }),
    z.object({
      numberOfPreviousKeepers: z.number(),
      make: z.string().optional(),
      model: z.string().optional(),
    }),
  ]),
  dateAdded: z.string(),
});

export const RetrieveCustomerSummaryByLinkingIdResponse = z.object({
  linkingId: z.uuid(),
  hasErrors: z.boolean(),
  customerResponse: z.object({
    customer: z.object({
      customerId: z.uuid(),
      recordStatus: z.enum(["Pending", "Substantive", "Retaining", "Deleting"]),
      customerType: z.enum(["Individual", "Organisation"]),
      individualDetails: z.object({
        lastName: z.string(),
        dateOfBirth: z.string(),
        firstNames: z.string().optional(),
        title: z.string().optional(),
      }),
      address: AddressUnion.optional(),
      emailAddress: z.string().optional(),
      phoneNumber: z.string().optional(),
      suppressions: z.array(
        z.object({
          suppressionType: z.enum(["DVLA", "Customer"]),
          suppressionDate: z.string(),
        }),
      ),
      products: z.array(ProductSchema).optional(),
      applications: z
        .array(
          z.object({
            applicationType: z.string(),
            applicationId: z.uuid(),
            applicationKey: z.string(),
            applicationState: z.object({
              status: z.string(),
              timeUpdated: z.string(),
            }),
          }),
        )
        .optional(),
    }),
  }),
  driversEligibilityResponse: EligibilitySchema.optional(),
  driversSuppressionResponse: z
    .object({
      drivingLicenceNumber: z.string(),
      suppressionStatus: z.array(
        z.object({
          role: z.string(),
          suppressed: z.boolean(),
        }),
      ),
    })
    .optional(),
  applicationTaskResponse: TaskResponseSchema.optional(),
  vehicleResponse: z.array(VehicleFullResponseSchema).optional(),
});
