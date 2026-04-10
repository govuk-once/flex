import z from "zod";

import { applications_response } from "../common";

const retrieve_customer_response = z.object({
  customer: z
    .object({
      customerId: z.uuid(),
      customerNumber: z.string().nullish(),
      identityId: z.string().nullish(),
      recordStatus: z
        .enum(["Pending", "Substantive", "Retaining", "Deleting"])
        .nullish(),
      customerType: z.enum(["Individual", "Organisation"]).nullish(),
      address: z
        .union([
          z.object({ structuredAddress: z.any() }),
          z.object({ unstructuredAddress: z.any() }),
          z.object({ bfpoAddress: z.any() }),
          z.object({ internationalAddress: z.any() }),
        ])
        .nullish(),
      emailAddress: z.string().nullish(),
      phoneNumber: z.string().nullish(),
      individualDetails: z
        .object({
          title: z.string().nullish(),
          firstNames: z.string().nullish(),
          lastName: z.string().nullish(),
          dateOfBirth: z.string().nullish(),
          notifiedOfDeath: z.any().nullish(),
        })
        .partial()
        .nullish(),
      products: z
        .array(
          z
            .object({
              productType: z.enum(["Driving Licence", "Vehicle"]).nullish(),
              productKey: z.string().nullish(),
              productIdentifier: z.string().nullish(),
              productSummary: z
                .union([
                  z.object({
                    licenceExpiryDate: z.string().nullish(),
                    licenceValidFrom: z.string().nullish(),
                    licenceType: z.enum(["Full", "Provisional"]).nullish(),
                    licenceStatus: z.string().nullish(),
                  }),
                  z.object({
                    numberOfPreviousKeepers: z.number().nullish(),
                    make: z.string().nullish(),
                    model: z.string().nullish(),
                    colour: z.string().nullish(),
                    secondaryColour: z.string().nullish(),
                  }),
                ])
                .nullish(),
              dateAdded: z.string().nullish(),
            })
            .partial()
            .loose(),
        )
        .nullish(),
    })
    .partial()
    .loose(),
});

const vehicle_full_response = z
  .object({
    registrationNumber: z.string().nullish(),
    recordType: z.string().nullish(),
    vehicleId: z.number().int().nullish(),
    chassisVin: z.string().nullish(),
    make: z.string().nullish(),
    model: z.string().nullish(),
    manufacturerVehicleType: z.string().nullish(),
    typeApprovalVariant: z.string().nullish(),
    typeApprovalVersion: z.string().nullish(),
    typeApprovalCategory: z.string().nullish(),
    typeApprovalNumber: z.string().nullish(),
    engineNumber: z.string().nullish(),
    euroStatus: z.string().nullish(),
    dateOfManufacture: z.string().nullish(),
    dateOfFirstRegistration: z.string().nullish(),
    engineCapacity: z.number().int().nullish(),
    maxNetPower: z.number().int().nullish(),
    bodyType: z.string().nullish(),
    seatingCapacity: z.number().int().nullish(),
    standingCapacity: z.number().int().nullish(),
    autonomousVehicle: z.boolean().nullish(),
    dateOfLiability: z.string().nullish(),
    taxClass: z.string().nullish(),
    motStatus: z.string().nullish(),
    colour: z.string().nullish(),
    fuelType: z.string().nullish(),
    wheelplan: z.string().nullish(),
    revenueWeight: z.number().int().nullish(),
    massInService: z.number().int().nullish(),
    maxPermissibleMass: z.number().int().nullish(),
    powerToWeightRatio: z.number().nullish(),
    roadFriendlySuspensionApplied: z.boolean().nullish(),
    realDrivingEmissions: z.string().nullish(),
    numberOfPreviousKeepers: z.number().int().nullish(),
    keeper: z
      .object({
        companyName: z.string().nullish(),
        fleetNumber: z.string().nullish(),
        title: z.string().nullish(),
        firstNames: z.string().nullish(),
        lastName: z.string().nullish(),
        start: z.string().nullish(),
        inTrade: z.boolean().nullish(),
        sensitiveKeeper: z.boolean().nullish(),
        address: z
          .union([
            z.object({ structuredAddress: z.any() }),
            z.object({ unstructuredAddress: z.any() }),
            z.object({ bfpoAddress: z.any() }),
            z.object({ internationalAddress: z.any() }),
          ])
          .nullish(),
      })
      .partial()
      .nullish(),
  })
  .partial()
  .loose();

export const RetrieveCustomerSummaryByLinkingIdResponse = z
  .object({
    linkingId: z.uuid().nullish(),
    customerResponse: retrieve_customer_response.nullish(),
    driversEligibilityResponse: applications_response.nullish(),
    driversSuppressionResponse: z.any().nullish(),
    applicationTaskResponse: z.any().nullish(),
    vehicleResponse: z.array(vehicle_full_response).nullish(),
    hasErrors: z.boolean().nullish(),
  })
  .loose();
