import { createUdpDomainClient } from "@client";
import { logger } from "@flex/logging";
import { it } from "@flex/testing";
import {
  createIdentityService,
  deleteIdentityService,
} from "@services/identityService";
import nock from "nock";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  vi,
} from "vitest";

vi.mock("@flex/logging");
vi.mock("@flex/flex-fetch");

describe("IdentityService", () => {
  const BASE_URL = "https://example.com";
  const SERVICE = "test-service";
  const IDENTIFIER = "user-123";

  const client = createUdpDomainClient({
    region: "eu-west-2",
    baseUrl: BASE_URL,
  });

  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(nock.isDone()).toBe(true);
    nock.cleanAll();
  });

  describe("createIdentityService", () => {
    it("successfully links service ID to user ID", async ({ userId }) => {
      const expectedPath = `/gateways/udp/v1/identity/${SERVICE}/${IDENTIFIER}`;

      nock(BASE_URL)
        .post(expectedPath, {
          appId: userId,
        })
        .reply(201, { success: true });

      await createIdentityService({
        client,
        service: SERVICE,
        serviceId: IDENTIFIER,
        userId,
      });

      expect(nock.isDone()).toBe(true);

      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        "service ID has now been linked to app ID",
      );
    });

    it.for([401, 403, 422, 500, 503])(
      "throws BadGateway when createServiceLink returns %s",
      async (statusCode, { userId }) => {
        nock(BASE_URL)
          .post(`/gateways/udp/v1/identity/${SERVICE}/${IDENTIFIER}`)
          .reply(statusCode, {
            message: "Upstream error",
            detail: "some details",
          });

        await expect(
          createIdentityService({
            client,
            service: SERVICE,
            serviceId: IDENTIFIER,
            userId,
          }),
        ).rejects.toMatchObject({
          status: 502,
        });
      },
    );
  });

  describe("deleteIdentityService", () => {
    const SERVICE = "test-service";
    const SERVICE_ID = "test-service-id";

    const GET_PATH = `/gateways/udp/v1/identity/${SERVICE}`;
    const DELETE_PATH = `${GET_PATH}/${SERVICE_ID}`;

    it("successfully unlinks service ID from app ID", async () => {
      nock(BASE_URL)
        .get(GET_PATH)
        .matchHeader("User-Id", SERVICE_ID)
        .reply(200, {
          serviceId: SERVICE_ID,
          serviceName: SERVICE,
        });

      nock(BASE_URL).delete(DELETE_PATH).reply(204);

      await deleteIdentityService({
        client,
        service: SERVICE,
        userId: SERVICE_ID,
      });

      expect(nock.isDone()).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        "service ID has now been unlinked to app ID",
      );
    });

    it("throws NotFound when the initial GET returns 404", async () => {
      nock(BASE_URL).get(GET_PATH).reply(404);

      await expect(
        deleteIdentityService({
          client,
          service: SERVICE,
          userId: SERVICE_ID,
        }),
      ).rejects.toMatchObject({ status: 404 });

      expect(logger.warn).toHaveBeenCalledWith(
        "Service link not found during deletion",
        { service: SERVICE },
      );
    });

    it("throws BadGateway when the DELETE call fails", async () => {
      nock(BASE_URL).get(GET_PATH).reply(200, {
        serviceId: SERVICE_ID,
        serviceName: SERVICE,
      });

      nock(BASE_URL).delete(DELETE_PATH).reply(500);

      await expect(
        deleteIdentityService({
          client,
          service: SERVICE,
          userId: SERVICE_ID,
        }),
      ).rejects.toMatchObject({ status: 502 });

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to unlink app ID to service ID",
        expect.any(Object),
      );
    });
  });
});
