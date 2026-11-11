import { NonEmptyString } from "@flex/utils";
import { z } from "zod";

const defectSchema = z
  .object({
    text: z.string().nullable().optional(),
    type: z
      .enum([
        "ADVISORY",
        "DANGEROUS",
        "FAIL",
        "MAJOR",
        "MINOR",
        "NON SPECIFIC",
        "SYSTEM GENERATED",
        "USER ENTERED",
      ])
      .nullable()
      .optional(),
    dangerous: z.boolean().nullable().optional(),
  })
  .meta({ id: "Defect" });

export const motTestSchema = z
  .object({
    registrationAtTimeOfTest: z.string().nullable().optional(),
    completedDate: NonEmptyString,
    testResult: z.enum(["PASSED", "FAILED"]),
    expiryDate: z.string().nullable().optional(),
    odometerValue: z.string().nullable().optional(),
    odometerUnit: z.enum(["MI", "KM"]).nullable().optional(),
    odometerResultType: z.enum(["READ", "UNREADABLE", "NO_ODOMETER"]),
    motTestNumber: z.string().nullable().optional(),
    dataSource: z.enum(["DVSA", "DVA NI", "CVS"]),
    location: z.string().nullable().optional(),
    defects: z.array(defectSchema).nullable().optional(),
  })
  .meta({ id: "MotTest" });

export const motVehicleResponseSchema = z
  .object({
    registration: z.string().nullable().optional(),
    make: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    firstUsedDate: z.string().nullable().optional(),
    fuelType: z.string().nullable().optional(),
    primaryColour: z.string().nullable().optional(),
    registrationDate: z.string().nullable().optional(),
    manufactureDate: z.string().nullable().optional(),
    engineSize: z.string().nullable().optional(),
    hasOutstandingRecall: z.enum(["Yes", "No", "Unknown", "Unavailable"]),
    motTests: z.array(motTestSchema),
  })
  .meta({ id: "MotVehicleResponse" });

export const newRegVehicleResponseSchema = z
  .object({
    registration: z.string().nullable().optional(),
    make: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    manufactureYear: z.string().nullable().optional(),
    fuelType: z.string().nullable().optional(),
    primaryColour: z.string().nullable().optional(),
    registrationDate: z.string().nullable().optional(),
    manufactureDate: z.string().nullable().optional(),
    motTestDueDate: z.string().nullable().optional(),
    hasOutstandingRecall: z.enum(["Yes", "No", "Unknown", "Unavailable"]),
  })
  .meta({ id: "NewRegVehicleResponse" });

export const vehicleByRegistrationResponseSchema = z
  .union([motVehicleResponseSchema, newRegVehicleResponseSchema])
  .meta({ id: "VehicleByRegistrationResponse" });
