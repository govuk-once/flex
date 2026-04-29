import { NonEmptyString } from "@flex/utils";
import z from "zod";

export const vehicleEnquiryRequestBodySchema = z.object({
  registrationNumber: NonEmptyString,
});

export const vehicleEnquiryResponseSchema = z.object({
  registrationNumber: z.string().describe("Registration number of the vehicle"),

  taxStatus: z
    .enum(["Not Taxed for on Road Use", "SORN", "Taxed", "Untaxed"])
    .optional()
    .describe("Tax status of the vehicle"),

  taxDueDate: z
    .string()
    .pipe(z.coerce.date())
    .optional()
    .describe("Date of tax liability"),

  artEndDate: z
    .string()
    .pipe(z.coerce.date())
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

  motExpiryDate: z
    .string()
    .pipe(z.coerce.date())
    .optional()
    .describe("Mot Expiry Date"),

  make: z.string().optional().describe("Vehicle make"),

  monthOfFirstDvlaRegistration: z
    .string()
    .optional()
    .describe("Month of First DVLA Registration (YYYY-MM)"),

  monthOfFirstRegistration: z
    .string()
    .optional()
    .describe("Month of First Registration (YYYY-MM)"),

  yearOfManufacture: z
    .number()
    .int()
    .optional()
    .describe("Year of Manufacture"),

  engineCapacity: z
    .number()
    .int()
    .optional()
    .describe("Engine capacity in cubic centimetres"),

  co2Emissions: z
    .number()
    .int()
    .optional()
    .describe("Carbon Dioxide emissions in grams per kilometre"),

  fuelType: z.string().optional().describe("Fuel type (Method of Propulsion)"),

  markedForExport: z
    .boolean()
    .optional()
    .describe("True only if vehicle has been export marked"),

  colour: z.string().optional().describe("Vehicle colour"),

  typeApproval: z
    .string()
    .optional()
    .describe("Vehicle Type Approval Category"),

  wheelplan: z.string().optional().describe("Vehicle wheel plan"),

  revenueWeight: z
    .number()
    .int()
    .optional()
    .describe("Revenue weight in kilograms"),

  realDrivingEmissions: z
    .string()
    .optional()
    .describe("Real Driving Emissions value"),

  dateOfLastV5CIssued: z
    .string()
    .pipe(z.coerce.date())
    .optional()
    .describe("Date of last V5C issued"),

  euroStatus: z.string().optional().describe("Euro Status"),

  automatedVehicle: z.boolean().optional().describe("Automated Vehicle (AV)"),
});
