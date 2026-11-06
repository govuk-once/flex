import { vehicleByRegistrationResponseSchema } from "@flex/dvsa-service-gateway";
import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { status } from "http-status";
import { describe, expect } from "vitest";

import { config as drivingConfig } from "../domain.config";

describe.runIf(isDomainDeployed(drivingConfig))("Driving domain", () => {
  describe("/driving/v1/vehicle/mot", () => {
    const validRegistration = "AA51AAA";
    const notFoundRegistration = "ZZ99ZZZ";
    const endpoint = (registration: string) =>
      `/driving/v1/vehicle/mot/${registration}`;

    describe.runIf(isRouteDeployed(drivingConfig, "GET /v1/vehicle/mot/:reg"))(
      "GET",
      () => {
        it("returns 200 and valid MOT data for a known registration", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(
            endpoint(validRegistration),
            { headers: authHeader },
          );

          expect(result.status).toBe(status.OK);

          const validation = vehicleByRegistrationResponseSchema.safeParse(
            result.body,
          );
          expect(validation.success).toBe(true);
        });

        it("returns 404 for a non-existent vehicle registration", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(
            endpoint(notFoundRegistration),
            { headers: authHeader },
          );

          expect(result.status).toBe(status.NOT_FOUND);
        });
      },
    );
  });
});
