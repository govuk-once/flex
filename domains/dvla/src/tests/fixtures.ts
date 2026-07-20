import {
  createTimestamp,
  createUserId,
  createUuid,
  mergeFixture,
  timestamp,
  token,
  uuid,
} from "@flex/testing";
import type { ServiceIdentityLink } from "@flex/udp-domain";
import type { DeepPartial } from "@flex/utils";
import { Session } from "@schemas/session";
import { ShareCode, SingleShareCode } from "@schemas/share-code";
import { Vehicle } from "@schemas/vehicle";

export { createUserId };
export const userId = createUserId("test-dvla-user");

export const createLinkingId = (
  value = createUuid("10c1ab58-76a0-4bdc-b284-d65dc7db4d73"),
) => value;
export const linkingId = createLinkingId();

export const withLinkingId = <T extends object>(value: T, id = linkingId) => ({
  ...value,
  linkingId: id,
});

export const createDvlaTestUser = (value = linkingId) => value;
export const dvlaTestUser = createDvlaTestUser();

export const createTokenId = (
  value = createUuid("8fc250d6-eff2-4c1e-b3e6-db08060bf146"),
) => value;
export const tokenId = createTokenId();

export const createCustomerId = (
  value = createUuid("1ed6f6f7-a286-42b5-a8e9-ffb49496155c"),
) => value;
export const customerId = createCustomerId();

export const createProductKey = (value = "test-product-id") => value;
export const productKey = createProductKey();

export const createRegistrationNumber = (value = "AA11ABC") => value;
export const registrationNumber = createRegistrationNumber();

export const createDrivingLicenceNumber = (value = "SMITH952052S99AB") => value;
export const drivingLicenceNumber = createDrivingLicenceNumber();

export const createServiceLinkId = (value = "test-servicelink-id") => value;
export const serviceLinkId = createServiceLinkId();

export const createServiceId = (value = linkingId) => value;
export const serviceId = createServiceId();

export const createServiceName = (value = "dvla") => value;
export const serviceName = createServiceName();

export const createServiceIdentityLink = (
  overrides?: DeepPartial<ServiceIdentityLink>,
) => mergeFixture<ServiceIdentityLink>({ serviceId, serviceName }, overrides);
export const serviceIdentityLink = createServiceIdentityLink();

export const createSession = (overrides?: DeepPartial<Session>) =>
  mergeFixture<Session>(
    {
      "id-token": token,
      apiKeyExpiry: createTimestamp("2030-01-01T00:00:00Z"),
      passwordExpiry: createTimestamp("2030-01-01T00:00:00Z"),
    },
    overrides,
  );
export const session = createSession();

export const createVehicle = (overrides?: DeepPartial<Vehicle>) =>
  mergeFixture<Vehicle>(
    {
      vehicle: {
        vehicleId: 123456,
        registrationNumber: registrationNumber,
        make: "TOYOTA",
        colour: "BLUE",
        fuelType: "PETROL",
        taxStatus: "Taxed",
      },
    },
    overrides,
  );
export const vehicle = createVehicle();

export const createShareCode = (overrides?: DeepPartial<ShareCode>) =>
  mergeFixture<ShareCode>(
    {
      state: "valid",
      tokenId,
      token: "XWRPTSMK",
      drivingLicenceNumber,
      driverId: uuid,
      documentReference: "DOC99999",
      created: timestamp,
      expiry: createTimestamp("2027-06-04T12:00:00.000Z"),
      status: "active",
    },
    overrides,
  );
export const shareCode = createShareCode();

export const createSingleShareCode = (
  overrides?: DeepPartial<SingleShareCode>,
) => mergeFixture<SingleShareCode>({ ...shareCode }, overrides);
export const singleShareCode = createSingleShareCode();

export const createUnlinkResult = (success = true) => ({ success });
export const unlinkResult = createUnlinkResult();
