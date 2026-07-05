import { NonEmptyString } from "@flex/utils";
import z from "zod";

import { commonRequestSchema } from "../common";
import { customerVehicleDetailsSchema as baseVehicleSchema } from "./customerVehicles";

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

const customerVehicleSchema = baseVehicleSchema.extend({
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
