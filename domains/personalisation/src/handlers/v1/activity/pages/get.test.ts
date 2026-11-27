import { it } from "@flex/testing";
import { userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/activity/pages", () => {
  const endpoint = "/activity/pages";
  const pages = [
    {
      id: "abcd1234",
      title: "Page title",
      date: 1760000000,
      url: "https://www.gov.uk/page",
    },
    {
      id: "dcba4321",
      title: "Another page",
      date: 1759000000,
      url: "https://www.gov.uk/another-page",
    },
  ];

  it("returns 200 with the visited pages", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get(endpoint, { headers: { "requesting-service-user-id": userId } })
      .reply(200, pages);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(pages);
  });

  it("returns 200 with an empty list when there are no visited pages", async ({
    http,
    sdk,
  }) => {
    http
      .gateway("udp")
      .get(endpoint, { headers: { "requesting-service-user-id": userId } })
      .reply(200, []);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual([]);
  });

  it("returns 502 when the UDP integration fails", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get(endpoint, { headers: { "requesting-service-user-id": userId } })
      .reply(500);

    const result = await handler(
      sdk.event.get(endpoint, { auth: userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
