import { token } from "@flex/testing";
import type { Session } from "@schemas/session";
import type { VehicleMot } from "@schemas/vehicle";

export const registrationNumber = "AB12CDE";

export const session: Session = {
  access_token: token,
  token_type: "Bearer",
  expires_in: 3600,
  ext_expires_in: 3600,
};

export const vehicleMot: VehicleMot = {
  registration: registrationNumber,
  make: "FORD",
  model: "FOCUS",
  firstUsedDate: "2015-03-20",
  fuelType: "Petrol",
  primaryColour: "Blue",
  hasOutstandingRecall: "No",
  motTests: [
    {
      completedDate: "2024-03-15T09:30:00.000Z",
      testResult: "PASSED",
      expiryDate: "2025-03-14",
      odometerValue: "45000",
      odometerUnit: "MI",
      odometerResultType: "READ",
      motTestNumber: "123456789012",
      dataSource: "DVSA",
      defects: [],
    },
  ],
};
