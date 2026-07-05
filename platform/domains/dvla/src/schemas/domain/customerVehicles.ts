import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

export const customerVehicleDetailsSchema = z.object({
  vehicleId: z.number().int().describe("Id of the vehicle within the SOR"),

  registrationNumber: NonEmptyString.describe("Formatted registration number"),

  make: NonEmptyString.describe("Vehicle Brand"),

  /**
   * NOTE
   * - keeping model nullish for now as test data is returning undefined,
   *   will remove once DVLA fix on their end
   */
  model: NonEmptyString.nullish().describe("Vehicle Brand Series"),

  taxStatus: z
    .enum(["Not Taxed for on Road Use", "SORN", "Untaxed", "Taxed"])
    .nullish()
    .describe("Tax status of the vehicle"),

  dateOfLiability: NonEmptyString.nullish().describe(
    "Date Of New Owner Legal Responsibility",
  ),

  sornStart: NonEmptyString.nullish().describe(
    "Start date of a most recent SORN",
  ),

  taxedUntil: NonEmptyString.nullish().describe(
    "The date the vehicle is taxed until",
  ),

  currentLicencePaymentMethod:
    NonEmptyString.nullish().describe("Payment Method"),

  motStatus: NonEmptyString.describe("The Vehicle MOT Status"),

  motExpiryDate: NonEmptyString.nullish().describe(
    "The Vehicle MOT Expiry Date",
  ),
});

export const customerVehiclesResponseSchema = z.object({
  customerVehicles: z
    .array(customerVehicleDetailsSchema)
    .describe("Array of GovUK App Service Customer Vehicles"),
});
