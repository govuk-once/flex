import { NonEmptyString, WholeNumber } from "@flex/utils";
import z from "zod";

export const vehicleEnquiryRequestBodySchema = z.object({
  registrationNumber: NonEmptyString,
  jwt: NonEmptyString,
});

export const vehicleSchema = z
  .object({
    vehicleId: z.number().int().describe("Id of the vehicle within the SOR"),

    registrationNumber: NonEmptyString.describe(
      "Registration number of the vehicle",
    ),

    taxStatus: z
      .enum(["Not Taxed for on Road Use", "SORN", "Taxed", "Untaxed"])
      .optional()
      .describe("Tax status of the vehicle"),

    taxedUntil: NonEmptyString.pipe(z.coerce.date())
      .optional()
      .describe("The date the vehicle is taxed until"),

    motStatus: z
      .enum([
        "No details held by DVLA",
        "No results returned",
        "Not valid",
        "Valid",
      ])
      .optional()
      .describe("MOT Status of the vehicle"),

    motExpiryDate: NonEmptyString.pipe(z.coerce.date())
      .optional()
      .describe("Mot Expiry Date"),

    make: NonEmptyString.optional().describe("Vehicle make"),

    dateOfFirstRegistration: NonEmptyString.pipe(z.coerce.date())
      .optional()
      .describe("Date Vehicle Was First Registered"),

    engineCapacity: WholeNumber.optional().describe(
      "Engine capacity in cubic centimetres",
    ),

    exhaustEmissionsCo2: WholeNumber.optional().describe(
      "Carbon Dioxide emissions in grams per kilometre",
    ),

    fuelType: NonEmptyString.optional().describe(
      "Fuel type (Method of Propulsion)",
    ),

    colour: NonEmptyString.optional().describe("Vehicle colour"),

    secondaryColour: NonEmptyString.optional().describe("Secondary vehicle colour"),
  })
  .meta({ id: "Vehicle" });

export const vehicleEnquiryResponseSchema = z.object({
  vehicle: vehicleSchema
}).meta({ id: "VehicleEnquiryResponse" });
