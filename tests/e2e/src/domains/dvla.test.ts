import { SSMProvider } from "@aws-lambda-powertools/parameters/ssm";
import { viewDriverResponseSchema } from "@flex/dvla-domain";
import {
  MultiShareCodeResponseSchema,
  SingleShareCodeResponseSchema,
  vehicleEnquiryResponseSchema,
} from "@flex/dvla-service-gateway";
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
    const baseEndpoint = "/dvla/v1/vehicle-enquiry";
    const validReg = "AA19AAA";
    const notFoundReg = "ER19NFD";

    describe("GET", () => {
      it("returns 200 and valid vehicle data for a known registration", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.get(
          `${baseEndpoint}/${validReg}`,
          {
            headers: { ...authorization },
          },
        );

        expect(result.status).toBe(200);

        const validation = vehicleEnquiryResponseSchema.safeParse(result.body);
        expect(validation.success).toBe(true);
      });

      it("returns 404 for a non-existent vehicle registration", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.get(
          `${baseEndpoint}/${notFoundReg}`,
          {
            headers: { ...authorization },
          },
        );

        expect(result.status).toBe(404);
      });

      it("returns 502 when upstream returns a 500 error", async ({
        cloudfront,
      }) => {
        const result = await cloudfront.client.get(`${baseEndpoint}/ER19ERR`, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(502);
      });
    });
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

      it("GET: returns 200 and lists all share codes", async ({
        cloudfront,
        withIdentityLink,
      }) => {
        await withIdentityLink("dvla", linkingId);

        const result = await cloudfront.client.get(listEndpoint, {
          headers: { ...authorization },
        });

        expect(result.status).toBe(200);

        const validation = MultiShareCodeResponseSchema.safeParse(result.body);
        expect(validation.success).toBe(true);

        if (validation.success) {
          const exists = validation.data.shareCodes.some(
            (sc) => sc.tokenId === createdTokenId,
          );
          expect(exists).toBe(true);
        }
      });

      it("DELETE: returns 200 and cancels the specified share code", async ({
        cloudfront,
        withIdentityLink,
      }) => {
        await withIdentityLink("dvla", linkingId);

        expect(createdTokenId).toBeDefined();

        const result = await cloudfront.client.delete(
          `${baseEndpoint}/${createdTokenId}`,
          {
            headers: { ...authorization },
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
