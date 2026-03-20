import { NonEmptyString } from "@flex/utils";
import z from "zod";

/** Request schema */
export const getCustomerRequestSchema = z.object({
  id: NonEmptyString,
  jwt: NonEmptyString,
});

/** Response schema */
const StructuredAddressSchema = z.object({
  structuredAddress: z.object({
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
  }),
});

const UnstructuredAddressSchema = z.object({
  unstructuredAddress: z.object({
    language: z.string().max(256).nullable().optional(),
    country: z.string().max(256).nullable().optional(),
    dps: z.string().max(2).nullable().optional(),
    line1: z.string().min(1).max(45),
    line2: z.string().max(45).nullable().optional(),
    line3: z.string().max(45).nullable().optional(),
    line4: z.string().max(45).nullable().optional(),
    line5: z.string().max(45).nullable().optional(),
    postcode: z.string().max(8),
  }),
});

const AddressSchema = z.union([
  StructuredAddressSchema,
  UnstructuredAddressSchema,
  z.object({ bfpoAddress: z.any() }),
  z.object({ internationalAddress: z.any() }),
]);

const IndividualDetailsSchema = z.object({
  title: z.string().optional(),
  firstNames: z.string().optional(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  notifiedOfDeath: z
    .object({
      notificationType: z.enum(["Confirmed", "Unconfirmed"]),
      notificationDate: z.string(),
    })
    .optional(),
});

const ProductSummarySchema = z.union([
  z.object({
    licenceExpiryDate: z.string().optional(),
    licenceValidFrom: z.string().optional(),
    licenceType: z.enum(["Full", "Provisional"]),
    licenceStatus: z.enum([
      "Valid",
      "Disqualified",
      "Revoked",
      "Revoked for medical reasons",
      "Surrendered",
      "Surrendered voluntarily",
      "Surrendered for medical reasons",
      "Expired",
      "Exchanged",
      "Refused",
      "Refused for medical reasons",
    ]),
  }),
  z.object({
    numberOfPreviousKeepers: z.number(),
    make: z.string().optional(),
    model: z.string().optional(),
    colour: z.string().optional(),
    secondaryColour: z.string().optional(),
  }),
]);

const ProductSchema = z.object({
  productType: z.enum(["Driving Licence", "Vehicle"]),
  productKey: z.string(),
  productIdentifier: z.string(),
  productSummary: ProductSummarySchema,
  dateAdded: z.string(),
});

export const CustomerSchema = z.object({
  customerId: z.uuid(),
  customerNumber: z.string().nullable().optional(),
  identityId: z.string().nullable().optional(),
  recordStatus: z.enum(["Pending", "Substantive", "Retaining", "Deleting"]),
  customerType: z.enum(["Individual", "Organisation"]),
  address: AddressSchema.nullable().optional(),
  emailAddress: z.string().optional(),
  phoneNumber: z.string().optional(),
  individualDetails: IndividualDetailsSchema,
  contactPreferences: z
    .array(
      z.object({
        contactType: z.string(),
        contactPreference: z.string(),
        consentDate: z.string(),
      }),
    )
    .optional(),
  products: z.array(ProductSchema).optional(),
  applications: z.array(z.any()).optional(),
  suppressions: z.array(
    z.object({
      suppressionType: z.enum(["DVLA", "Customer"]),
      suppressionDate: z.string(),
    }),
  ),
  languagePreference: z.enum(["Welsh", "English"]).nullable().optional(),
});

export const getCustomerResponseSchema = z.object({
  linkingId: z.uuid(),
  customer: CustomerSchema,
});
