import { getLogger } from "@flex/logging";
import nock from "nock";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createUdpDomainClient } from "../client";
import { postIdentityService } from "./identityService";

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

describe("postIdentityService", () => {
  const BASE_URL = "https://example.com";
  const region = "eu-west-2";
  const appId = "test-app-id";
  const service = "test-service";
  const serviceId = "test-service-id";

  const client = createUdpDomainClient({
    region,
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

  it("successfully links service ID to app ID", async () => {
    const logger = getLogger();
    const expectedPath = `/gateways/udp/v1/identity/${service}/${serviceId}`;

    nock(BASE_URL)
      .post(expectedPath, {
        appId,
      })
      .reply(201, { success: true });

    await postIdentityService({
      client,
      service,
      serviceId,
      appId,
    });

    expect(nock.isDone()).toBe(true);

    /* eslint-disable @typescript-eslint/unbound-method */
    const { info, error } = logger;

    expect(error).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      "service ID has now been linked to app ID",
    );
  });

  it.each([401, 403, 422, 500, 503])(
    "throws BadGateway when createServiceLink returns %s",
    async (statusCode) => {
      nock(BASE_URL)
        .post(`/gateways/udp/v1/identity/${service}/${serviceId}`)
        .reply(statusCode, {
          message: "Upstream error",
          detail: "some details",
        });

      await expect(
        postIdentityService({
          client,
          service,
          serviceId,
          appId,
        }),
      ).rejects.toMatchObject({
        status: 502,
      });
    },
  );
});
