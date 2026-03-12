import { createUdpDomainClient } from "@client";
import { getLogger } from "@flex/logging";
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

vi.mock("@flex/logging", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@flex/flex-fetch", async (actual) => ({
  ...(await actual()),
  createSigv4Fetcher:
    ({ baseUrl }: { baseUrl: string }) =>
    (path: string, options?: RequestInit) => ({
      request: fetch(`${baseUrl}${path}`, options),
      abort: vi.fn(),
    }),
}));

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
    it("successfully links service ID to app ID", async ({ userId }) => {
      const logger = getLogger();
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
        appId: userId,
      });

      expect(nock.isDone()).toBe(true);

      /* eslint-disable @typescript-eslint/unbound-method */
      const { info, error } = logger;

      expect(error).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalledWith(
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
            appId: userId,
          }),
        ).rejects.toMatchObject({
          status: 502,
        });
      },
    );
  });

  describe("deleteIdentityService", () => {
    const EXPECTED_PATH = `/gateways/udp/v1/identity/${SERVICE}`;

    it("successfully unlinks service ID from app ID", async ({ userId }) => {
      const logger = getLogger();

      nock(BASE_URL).delete(EXPECTED_PATH).reply(204);

      await deleteIdentityService({
        client,
        service: SERVICE,
        appId: userId,
      });

      expect(nock.isDone()).toBe(true);

      /* eslint-disable @typescript-eslint/unbound-method */
      const { info, error } = logger;

      expect(error).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalledWith(
        "service ID has now been unlinked to app ID",
      );
    });

    it.for([401, 403, 404, 500, 503])(
      "throws BadGateway when deleteServiceLink returns %s",
      async (statusCode, { userId }) => {
        nock(BASE_URL).delete(EXPECTED_PATH).reply(statusCode, {
          message: "Upstream error",
        });

        await expect(
          deleteIdentityService({
            client,
            service: SERVICE,
            appId: userId,
          }),
        ).rejects.toMatchObject({
          status: 502,
        });

        /* eslint-disable @typescript-eslint/unbound-method */
        expect(getLogger().error).toHaveBeenCalled();
      },
    );
  });
});
