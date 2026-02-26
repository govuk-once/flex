import { it } from "@flex/testing";
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

import { handler } from "./patch";

vi.mock("@flex/params", () => ({
  getConfig: vi.fn(() =>
    Promise.resolve({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL: "https://execute-api.eu-west-2.amazonaws.com",
    }),
  ),
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

describe("PATCH /user handler", () => {
  const BASE_URL = "https://execute-api.eu-west-2.amazonaws.com";

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

  it("calls private PATCH and returns mapped preferences", async ({
    response,
    eventWithAuthorizer,
    context,
  }) => {
    nock(BASE_URL)
      .patch("/domains/udp/v1/user", {
        preferences: {
          notifications: {
            consentStatus: "accepted",
          },
        },
      })
      .reply(200, {
        preferences: {
          notifications: {
            consentStatus: "accepted",
          },
        },
      });

    const request = await handler(
      eventWithAuthorizer.authenticated({
        body: JSON.stringify({
          preferences: {
            notifications: {
              consentStatus: "accepted",
            },
          },
        }),
      }),
      context.withPairwiseId().create(),
    );

    expect(request).toEqual(
      response.ok(
        {
          preferences: {
            notifications: {
              consentStatus: "accepted",
            },
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
  });

  it("rejects invalid payload", async ({ eventWithAuthorizer, context }) => {
    const result = await handler(
      eventWithAuthorizer.authenticated({
        body: JSON.stringify({
          preferences: {
            notifications: {
              consentStatus: "yes",
            },
          },
        }),
      }),
      context.withPairwiseId().create(),
    );

    expect(result).toEqual(expect.objectContaining({ statusCode: 400 }));
  });
});
