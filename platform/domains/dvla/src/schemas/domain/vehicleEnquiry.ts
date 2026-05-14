import { NonEmptyString, WholeNumber } from "@flex/utils";
import z from "zod";

export const vehicleEnquiryRequestBodySchema = z.object({
  registrationNumber: NonEmptyString,
});

export const vehicleEnquiryResponseSchema = z
  .object({
    registrationNumber: NonEmptyString.describe(
      "Registration number of the vehicle",
    ),

    taxStatus: z
      .enum(["Not Taxed for on Road Use", "SORN", "Taxed", "Untaxed"])
      .optional()
      .describe("Tax status of the vehicle"),

    taxDueDate: NonEmptyString.pipe(z.coerce.date())
      .optional()
      .describe("Date of tax liability"),

    artEndDate: NonEmptyString.pipe(z.coerce.date())
      .optional()
      .describe("Additional Rate of Tax End Date"),

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

    monthOfFirstDvlaRegistration: NonEmptyString.regex(
      /^\d{4}-(0[1-9]|1[0-2])$/,
    )
      .optional()
      .describe("Month of First DVLA Registration (YYYY-MM)"),

    monthOfFirstRegistration: NonEmptyString.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional()
      .describe("Month of First Registration (YYYY-MM)"),

    yearOfManufacture: WholeNumber.optional().describe("Year of Manufacture"),

    engineCapacity: WholeNumber.optional().describe(
      "Engine capacity in cubic centimetres",
    ),

    co2Emissions: WholeNumber.optional().describe(
      "Carbon Dioxide emissions in grams per kilometre",
    ),

    fuelType: NonEmptyString.optional().describe(
      "Fuel type (Method of Propulsion)",
    ),

    markedForExport: z
      .boolean()
      .optional()
      .describe("True only if vehicle has been export marked"),

    colour: NonEmptyString.optional().describe("Vehicle colour"),

    typeApproval: NonEmptyString.optional().describe(
      "Vehicle Type Approval Category",
    ),

    wheelplan: NonEmptyString.optional().describe("Vehicle wheel plan"),

    revenueWeight: WholeNumber.optional().describe(
      "Revenue weight in kilograms",
    ),

    realDrivingEmissions: NonEmptyString.optional().describe(
      "Real Driving Emissions value",
    ),

    dateOfLastV5CIssued: NonEmptyString.pipe(z.coerce.date())
      .optional()
      .describe("Date of last V5C issued"),

    euroStatus: NonEmptyString.optional().describe("Euro Status"),

    automatedVehicle: z.boolean().optional().describe("Automated Vehicle (AV)"),
  })
  .meta({ id: "VehicleEnquiryResponse" });
