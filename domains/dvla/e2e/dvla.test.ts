import { SSMProvider } from "@aws-lambda-powertools/parameters/ssm";
import { vehicleEnquiryResponseSchema } from "@flex/dvla-service-gateway";
import { isDomainDeployed, isRouteDeployed } from "@flex/sdk";
import { it } from "@flex/testing/e2e";
import { config as udpConfig } from "@flex/udp-domain/config";
import { beforeAll, describe, expect, inject } from "vitest";

import { config as dvlaConfig } from "../domain.config";

const ssmProvider = new SSMProvider();

const udpCreateIdentityDeployed = () =>
  isRouteDeployed(udpConfig, "POST /v1/identity/:service");
const udpDeleteIdentityDeployed = () =>
  isRouteDeployed(udpConfig, "DELETE /v1/identity/:service");

// TODO need to updating linking process to match new POST endpoint
describe.runIf(isDomainDeployed(dvlaConfig)).todo("DVLA domain", () => {
  const { ENVIRONMENT } = inject("e2eEnv");
  let linkingId: string;

  beforeAll(async () => {
    const rawLinkingId = await ssmProvider.get<string>(
      `/${ENVIRONMENT}/flex-param/dvla/test-user`,
    );

    if (!rawLinkingId) {
      throw new Error(`Parameter not found for environment: ${ENVIRONMENT}`);
    }

    linkingId = rawLinkingId;
  });

  describe("/dvla/v1/test-notification", () => {
    const endpoint = "/dvla/v1/test-notification";

    describe.runIf(
      isRouteDeployed(dvlaConfig, "POST /v1/test-notification") &&
        udpCreateIdentityDeployed() &&
        udpDeleteIdentityDeployed(),
    )("POST", () => {
      it("returns 202 when identity is linked and notification is sent", async ({
        cloudfront,
        withIdentityLink,
        authHeader,
      }) => {
        await withIdentityLink("dvla", linkingId);

        const result = await cloudfront.client.post(endpoint, {
          headers: authHeader,
          body: {},
        });

        expect(result.status).toBe(202);
      });

      it("returns 404 when user has no identity link", async ({
        cloudfront,
        withCleanIdentity,
        authHeader,
      }) => {
        await withCleanIdentity("dvla");

        const result = await cloudfront.client.post(endpoint, {
          headers: authHeader,
          body: {},
        });

        expect(result.status).toBe(404);
      });
    });
  });

  describe("/dvla/v1/vehicle-enquiry", () => {
    const mockRegistration = {
      valid: "AA19AAA",
      notFound: "ER19NFD",
      upstreamError: "ER19ERR",
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

          expect(result.status).toBe(200);

          const validation = vehicleEnquiryResponseSchema.safeParse(
            result.body,
          );
          expect(validation.success).toBe(true);
        });

        it("returns 404 for a non-existent vehicle registration", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(
            endpoint(mockRegistration.notFound),
            { headers: authHeader },
          );

          expect(result.status).toBe(404);
        });

        it("returns 502 when upstream returns a 500 error", async ({
          cloudfront,
          authHeader,
        }) => {
          const result = await cloudfront.client.get(
            endpoint(mockRegistration.upstreamError),
            { headers: authHeader },
          );

          expect(result.status).toBe(502);
        });
      },
    );
  });
});
