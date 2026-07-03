import { NonEmptyString } from "@flex/utils";
import z from "zod";

import { commonRequestSchema } from "../common";

export const customerVehicleRequestSchema = commonRequestSchema.extend({
  vehicleId: NonEmptyString,
});

const vehicleColourEnum = z.enum([
  "BROWN",
  "BRONZE",
  "RED",
  "PINK",
  "ORANGE",
  "YELLOW",
  "GOLD",
  "GREEN",
  "BLUE",
  "PURPLE",
  "GREY",
  "SILVER",
  "WHITE",
  "BLACK",
  "MULTI-COLOUR",
  "BEIGE",
  "MAROON",
  "TURQUOISE",
  "CREAM",
  "NOT STATED",
]);

const customerVehicleSchema = z.object({
  vehicleId: z.number().int().describe("Id of the vehicle within the SOR"),

  registrationNumber: NonEmptyString.describe("Formatted registration number"),

  make: NonEmptyString.describe("Vehicle Brand"),

  // TODO ask dvla as this is coming through as undefined
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

  dateOfFirstRegistration: NonEmptyString.describe(
    "Date Vehicle Was First Registered",
  ),

  dateOfManufacture: NonEmptyString.nullish().describe(
    "Date Vehicle Was Manufactured",
  ),

  fuelType: z
    .enum([
      "PETROL",
      "DIESEL",
      "ELECTRICITY",
      "STEAM",
      "GAS",
      "PETROL/GAS",
      "GAS BI-FUEL",
      "HYBRID ELECTRIC",
      "GAS DIESEL",
      "FUEL CELLS",
      "ELECTRIC DIESEL",
      "OTHER",
    ])
    .describe("Fuel Type Used By Vehicle"),

  colour: vehicleColourEnum.describe("Colour of the vehicle"),

  secondaryColour: vehicleColourEnum
    .nullish()
    .describe(
      "Secondary colour applicable if the vehicle has more than one colour",
    ),

  keeperTitle: NonEmptyString.nullish().describe("Keeper Title"),

  keeperFirstNames: NonEmptyString.nullish().describe("Keeper First Name"),

  keeperLastName: NonEmptyString.nullish().describe("Keeper Last Name"),

  keeperFullAddress: NonEmptyString.nullish().describe(
    String.raw`Keeper full address in a single string with the format "line1\nline2\nline3\nline4\nline5\npostcode"`,
  ),

  engineCapacity: z
    .number()
    .int()
    .nullish()
    .describe("Size of engine cylinders (if applicable)"),

  exhaustEmissionsCo2: z
    .number()
    .nullish()
    .describe("Carbon dioxide emissions."),
});

export const customerVehicleDetailsSchema = z.object({
  customerVehicleDetails: customerVehicleSchema,
});
