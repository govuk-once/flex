import {
  customerDriversLicenceSchema,
  customerVehicleDetailsSchema,
  customerVehiclesResponseSchema,
  SingleShareCodeResponseSchema,
  vehicleEnquiryResponseSchema,
} from "@flex/dvla-service-gateway";
import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { createApi, it } from "@flex/testing/e2e";
import { status } from "http-status";
import { beforeAll, describe, expect, inject } from "vitest";

import { config as dvlaConfig } from "../domain.config";

describe.runIf(isDomainDeployed(dvlaConfig))("DVLA domain", () => {
  describe("/dvla/v1/customer", () => {
    const endpointBase = "/dvla/v1/customer";

    describe.runIf(isRouteDeployed(dvlaConfig, "GET /v1/customer/licence"))(
      "/licence",
      () => {
        it("returns 200 with valid licence data", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(
            `${endpointBase}/licence`,
            {
              headers: authHeader,
            },
          );

          expect(result.status).toBe(status.OK);
          const validation = customerDriversLicenceSchema.safeParse(
            result.body,
          );

          expect(validation.success).toBe(true);
        });
      },
    );

    describe.runIf(
      isRouteDeployed(dvlaConfig, "GET /v1/customer/vehicles") &&
        isRouteDeployed(dvlaConfig, "GET /v1/customer/vehicle/:id"),
    )("/vehicles", () => {
      let vehicleId: string | undefined;

      beforeAll(async () => {
        const { FLEX_API_URL, JWT, E2E_BYPASS_TOKEN } = inject("e2eEnv");
        const client = createApi(`${FLEX_API_URL}/app`);

        const result = await client.client.get(`${endpointBase}/vehicles`, {
          headers: {
            Authorization: `Bearer ${JWT.VALID}`,
            "x-flex-e2e-bypass": E2E_BYPASS_TOKEN,
          },
        });

        const validation = customerVehiclesResponseSchema.safeParse(
          result.body,
        );
        if (validation.success) {
          vehicleId = validation.data.customerVehicles[0]?.vehicleId.toString();
        }
      });

      it("returns 200 with valid vehicles data", async ({
        cloudfront,
        authHeader,
      }) => {
        const result = await cloudfront.client.get(`${endpointBase}/vehicles`, {
          headers: authHeader,
        });

        expect(result.status).toBe(status.OK);
        const validation = customerVehiclesResponseSchema.safeParse(
          result.body,
        );
        expect(validation.success).toBe(true);
      });

      it("returns 200 with valid vehicle data", async ({
        cloudfront,
        authHeader,
      }) => {
        expect(vehicleId, "Expected a valid vehicleId").toBeDefined();

        const result = await cloudfront.client.get(
          `${endpointBase}/vehicle/${vehicleId ?? ""}`,
          {
            headers: authHeader,
          },
        );

        expect(result.status).toBe(status.OK);
        const validation = customerVehicleDetailsSchema.safeParse(result.body);
        expect(validation.success).toBe(true);
      });
    });
  });

  describe("/dvla/share-code", () => {
    const endpointBase = "/dvla/v1/share-code";
    let sharecodeId: string | undefined;

    describe.runIf(
      isRouteDeployed(dvlaConfig, "POST /v1/share-code") &&
        isRouteDeployed(dvlaConfig, "POST /v1/share-code/:id/cancel"),
    )("/dvla/v1/share-code & /dvla/v1/share-code/:id/cancel", () => {
      it("creates and then proceeds to cancel newly created share-code", async ({
        cloudfront,
        authHeader,
      }) => {
        const result = await cloudfront.client.post(endpointBase, {
          headers: authHeader,
          body: {},
        });

        expect(result.status).toBe(status.OK);
        const validation = SingleShareCodeResponseSchema.safeParse(result.body);

        expect(validation.success).toBe(true);

        if (validation.success) {
          sharecodeId = validation.data.tokenId;
          const result = await cloudfront.client.post(
            `${endpointBase}/${sharecodeId}/cancel`,
            {
              headers: authHeader,
              body: {},
            },
          );
          expect(result.status).toBe(status.OK);
          const validationCancel = SingleShareCodeResponseSchema.safeParse(
            result.body,
          );
          expect(validationCancel.success).toBe(true);
        }
      });
    });
  });

  describe("/dvla/v1/test-notification", () => {
    const endpoint = "/dvla/v1/test-notification";

    describe.runIf(isRouteDeployed(dvlaConfig, "POST /v1/test-notification"))(
      "POST",
      () => {
        it("returns 202 when identity is linked and notification is sent", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.post(endpoint, {
            headers: authHeader,
            body: {},
          });

          expect(result.status).toBe(status.ACCEPTED);
        });
      },
    );
  });

  describe("/dvla/v1/vehicle-enquiry", () => {
    const mockRegistration = {
      badRequest: "ER19BAD",
      notFound: "ER19NFD",
      tooManyRequests: "ER19THR",
      upstreamError: "ER19ERR",
      valid: "AA19AAA",
    };
    const endpoint = (registration: string) =>
      `/dvla/v1/vehicle-enquiry/${registration}`;

    describe.runIf(isRouteDeployed(dvlaConfig, "GET /v1/vehicle-enquiry/:reg"))(
      "GET",
      () => {
        it("returns 200 and valid vehicle data for a known registration", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(
            endpoint(mockRegistration.valid),
            { headers: authHeader },
          );

          expect(result.status).toBe(status.OK);

          const validation = vehicleEnquiryResponseSchema.safeParse(
            result.body,
          );
          expect(validation.success).toBe(true);
        });

        it("returns 502 when upstream returns a 500 error", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(
            endpoint(mockRegistration.upstreamError),
            { headers: authHeader },
          );

          expect(result.status).toBe(status.BAD_GATEWAY);
        });

        /**
         * The below are no longer working with the new VES service DVLA are
         * providing us, now returning 500 for these codes
         * - Ask DVLA to look into their new service, will update the below once
         *   resolved
         */
        it.todo(
          "returns 404 for a non-existent vehicle registration",
          async ({ cloudfront, authHeader }) => {
            const result = await cloudfront.client.get(
              endpoint(mockRegistration.notFound),
              { headers: authHeader },
            );

            expect(result.status).toBe(status.NOT_FOUND);
          },
        );

        it.todo(
          "returns 400 for a bad vehicle registration request",
          async ({ cloudfront, authHeader }) => {
            const result = await cloudfront.client.get(
              endpoint(mockRegistration.badRequest),
              { headers: authHeader },
            );

            expect(result.status).toBe(status.BAD_REQUEST);
          },
        );

        it.todo(
          "returns 429 for when too many requests hits their service",
          async ({ cloudfront, authHeader }) => {
            const result = await cloudfront.client.get(
              endpoint(mockRegistration.tooManyRequests),
              { headers: authHeader },
            );

            expect(result.status).toBe(status.TOO_MANY_REQUESTS);
          },
        );
      },
    );
  });
});
