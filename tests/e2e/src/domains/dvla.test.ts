import { SSMProvider } from "@aws-lambda-powertools/parameters/ssm";
import { config as dvlaConfig } from "@flex/dvla-domain/config";
import {
  MultiShareCodeResponseSchema,
  SingleShareCodeResponseSchema,
  vehicleEnquiryResponseSchema,
  viewDriverResponseSchema,
} from "@flex/dvla-service-gateway";
import { config as udpConfig } from "@flex/udp-domain/config";
import { beforeAll, describe, expect, inject } from "vitest";

import { it } from "../extend/it";
import { isDomainDeployed, isRouteDeployed } from "../utils/is-deployed";

const ssmProvider = new SSMProvider();

const udpCreateIdentityDeployed = () =>
  isRouteDeployed(udpConfig, "POST /v1/identity/:service/:id");
const udpDeleteIdentityDeployed = () =>
  isRouteDeployed(udpConfig, "DELETE /v1/identity/:service");

describe.runIf(isDomainDeployed(dvlaConfig)).sequential("DVLA domain", () => {
  const { JWT, ENVIRONMENT } = inject("e2eEnv");
  const authorization = { Authorization: `Bearer ${JWT.VALID}` };
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

  describe("/dvla/v1/driving-licence", () => {
    const endpoint = "/dvla/v1/driving-licence";

    describe.runIf(
      isRouteDeployed(dvlaConfig, "GET /v1/driving-licence") &&
        udpCreateIdentityDeployed() &&
        udpDeleteIdentityDeployed(),
    )("GET", () => {
      it("returns 200 and valid data when identity is linked", async ({
        cloudfront,
        withIdentityLink,
      }) => {
        await withIdentityLink("dvla", linkingId);

        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });
        expect(result.status).toBe(200);

        const validation = viewDriverResponseSchema.safeParse(result.body);
        expect(validation.success).toBe(true);
      });

      it("returns 404 when user is not linked", async ({
        cloudfront,
        withCleanIdentity,
      }) => {
        await withCleanIdentity("dvla");

        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });
        expect(result.status).toBe(404);
      });
    });
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
      }) => {
        await withIdentityLink("dvla", linkingId);

        const result = await cloudfront.client.post(endpoint, {
          headers: { ...authorization },
          body: {},
        });

        expect(result.status).toBe(202);
      });

      it("returns 404 when user has no identity link", async ({
        cloudfront,
        withCleanIdentity,
      }) => {
        await withCleanIdentity("dvla");

        const result = await cloudfront.client.post(endpoint, {
          headers: { ...authorization },
          body: {},
        });

        expect(result.status).toBe(404);
      });
    });
  });

  describe("/dvla/v1/driver-summary", () => {
    const endpoint = "/dvla/v1/driver-summary";

    describe.runIf(
      isRouteDeployed(dvlaConfig, "GET /v1/driver-summary") &&
        udpCreateIdentityDeployed() &&
        udpDeleteIdentityDeployed(),
    )("GET", () => {
      it("returns 200 when identity is linked and driver-summary is fetched", async ({
        cloudfront,
        withIdentityLink,
      }) => {
        await withIdentityLink("dvla", linkingId);

        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(200);
      });

      it("returns 404 when user has no identity link", async ({
        cloudfront,
        withCleanIdentity,
      }) => {
        await withCleanIdentity("dvla");

        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(404);
      });
    });
  });

  describe("/dvla/v1/customer-summary", () => {
    const endpoint = "/dvla/v1/customer-summary";

    describe.runIf(
      isRouteDeployed(dvlaConfig, "GET /v1/customer-summary") &&
        udpCreateIdentityDeployed() &&
        udpDeleteIdentityDeployed(),
    )("GET", () => {
      it("returns 200 when identity is linked and customer-summary is fetched", async ({
        cloudfront,
        withIdentityLink,
      }) => {
        await withIdentityLink("dvla", linkingId);

        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(200);
      });

      it("returns 404 when user has no identity link", async ({
        cloudfront,
        withCleanIdentity,
      }) => {
        await withCleanIdentity("dvla");

        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
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
        }) => {
          const result = await cloudfront.client.get(
            endpoint(mockRegistration.valid),
            { headers: { ...authorization } },
          );

          expect(result.status).toBe(200);

          const validation = vehicleEnquiryResponseSchema.safeParse(
            result.body,
          );
          expect(validation.success).toBe(true);
        });

        it("returns 404 for a non-existent vehicle registration", async ({
          cloudfront,
        }) => {
          const result = await cloudfront.client.get(
            endpoint(mockRegistration.notFound),
            { headers: { ...authorization } },
          );

          expect(result.status).toBe(404);
        });

        it("returns 502 when upstream returns a 500 error", async ({
          cloudfront,
        }) => {
          const result = await cloudfront.client.get(
            endpoint(mockRegistration.upstreamError),
            { headers: { ...authorization } },
          );

          expect(result.status).toBe(502);
        });
      },
    );
  });

  describe("/dvla/v1/share-code(s)", () => {
    const listEndpoint = "/dvla/v1/share-codes";
    const baseEndpoint = "/dvla/v1/share-code";
    let createdTokenId: string;

    describe("Flow: Create, List, and Delete", () => {
      it("POST: returns 200 and creates a new share code", async ({
        cloudfront,
        withIdentityLink,
      }) => {
        await withIdentityLink("dvla", linkingId);

        const result = await cloudfront.client.post(baseEndpoint, {
          headers: { ...authorization },
          body: {},
        });

        expect(result.status).toBe(200);

        const validation = SingleShareCodeResponseSchema.safeParse(result.body);
        expect(validation.success).toBe(true);

        if (validation.success) {
          createdTokenId = validation.data.shareCode.tokenId;
        }
      });

      it.todo(
        "GET: returns 200 and lists all share codes",
        async ({ cloudfront, withIdentityLink }) => {
          await withIdentityLink("dvla", linkingId);

          const result = await cloudfront.client.get(listEndpoint, {
            headers: { ...authorization },
          });

          expect(result.status).toBe(200);

          const validation = MultiShareCodeResponseSchema.safeParse(
            result.body,
          );
          expect(validation.success).toBe(true);

          if (validation.success) {
            const exists = validation.data.shareCodes.some(
              (sc) => sc.tokenId === createdTokenId,
            );
            expect(exists).toBe(true);
          }
        },
      );

      it("POST: returns 200 and cancels the specified share code", async ({
        cloudfront,
        withIdentityLink,
      }) => {
        await withIdentityLink("dvla", linkingId);

        expect(createdTokenId).toBeDefined();

        const result = await cloudfront.client.post(
          `${baseEndpoint}/${createdTokenId}/cancel`,
          {
            headers: { ...authorization },
            body: {},
          },
        );

        expect(result.status).toBe(200);

        const validation = SingleShareCodeResponseSchema.safeParse(result.body);
        expect(validation.success).toBe(true);

        if (validation.success) {
          expect(validation.data.shareCode.state).toBe("cancelled");
          expect(validation.data.shareCode.tokenId).toBe(createdTokenId);
        }
      });
    });

    describe("Edge Cases", () => {
      it("GET: returns 404 when user is not linked", async ({
        cloudfront,
        withCleanIdentity,
      }) => {
        await withCleanIdentity("dvla");

        const result = await cloudfront.client.get(listEndpoint, {
          headers: { ...authorization },
        });
        expect(result.status).toBe(404);
      });
    });
  });
});
