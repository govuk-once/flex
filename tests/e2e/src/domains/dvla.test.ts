import { SSMProvider } from "@aws-lambda-powertools/parameters/ssm";
import { viewDriverResponseSchema } from "@flex/dvla-domain";
import { vehicleEnquiryResponseSchema } from "@flex/dvla-service-gateway";
import { beforeAll, describe, expect, inject } from "vitest";

import { it } from "../extend/it";

describe.sequential("DVLA domain", () => {
  const { JWT, ENVIRONMENT } = inject("e2eEnv");
  const authorization = { Authorization: `Bearer ${JWT.VALID}` };
  const ssmProvider = new SSMProvider();
  let linkingId: string;

  beforeAll(async () => {
    const rawLinkingId = await ssmProvider.get<string>(
      `/${ENVIRONMENT}/flex-param/dvla/test-user`,
    );
    if (!rawLinkingId)
      throw new Error(`Parameter not found for environment: ${ENVIRONMENT}`);

    linkingId = rawLinkingId;
  });

  describe("/dvla/v1/driving-licence", () => {
    const endpoint = "/dvla/v1/driving-licence";

    describe("GET", () => {
      // TODO: Failing test exceeds 30s timeout
      it.todo(
        "returns 200 and valid data when identity is linked",
        async ({ cloudfront, withIdentityLink }) => {
          await withIdentityLink("dvla", linkingId);

          const result = await cloudfront.client.get(endpoint, {
            headers: { ...authorization },
          });
          expect(result.status).toBe(200);

          const validation = viewDriverResponseSchema.safeParse(result.body);
          expect(validation.success).toBe(true);
        },
      );

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

    describe("POST", () => {
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

    describe("GET", () => {
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

    describe("GET", () => {
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
    const endpoint = "/dvla/v1/vehicle-enquiry";
    const validReg = "AA19AAA";
    const notFoundReg = "ER19NFD";

    describe("GET", () => {
      it("returns 200 and valid vehicle data for a known registration", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: {
            ...authorization,
            registrationNumber: validReg,
          },
        });

        expect(result.status).toBe(200);

        const validation = vehicleEnquiryResponseSchema.safeParse(result.body);

        expect(validation.success).toBe(true);
      });

      it("returns 400 when registrationNumber header is missing", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(400);
      });

      it("returns 404 when vehicle is not found", async ({ cloudfront }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: {
            ...authorization,
            registrationNumber: notFoundReg,
          },
        });

        expect(result.status).toBe(404);
      });

      it("returns 502 when upstream returns a 500 error", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.get(endpoint, {
          headers: {
            ...authorization,
            registrationNumber: "ER19ERR",
          },
        });

        expect(result.status).toBe(502);
      });
    });
  });
});
