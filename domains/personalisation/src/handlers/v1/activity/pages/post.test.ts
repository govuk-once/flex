import { it } from "@flex/testing";
import { userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("POST /v1/activity/pages", () => {
  const endpoint = "/activity/pages";
  const page = {
    id: "abcd1234",
    title: "Page title",
    date: 1760000000,
    url: "https://www.gov.uk/page",
  };

  it("returns 204 when the page is stored", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .post("/activity/pages", {
        headers: { "requesting-service-user-id": userId },
        body: page,
      })
      .reply(200);

    const result = await handler(
      sdk.event.post(endpoint, { auth: userId, body: page }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(204);
  });

  it.for([
    { reason: "url is invalid", body: { ...page, url: "not-a-url" } },
    { reason: "date is not an integer", body: { ...page, date: 1.5 } },
    { reason: "title is missing", body: { ...page, title: undefined } },
    { reason: "body is empty", body: {} },
  ])("returns 400 when $reason", async ({ body }, { sdk }) => {
    const result = await handler(
      sdk.event.post(endpoint, { auth: userId, body }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(400);
  });

  it("returns 502 when the UDP integration fails", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .post("/activity/pages", {
        headers: { "requesting-service-user-id": userId },
        body: page,
      })
      .reply(500);

    const result = await handler(
      sdk.event.post(endpoint, { auth: userId, body: page }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
