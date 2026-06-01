import { it } from "@flex/testing";
import { createUserId } from "@utils/parser";
import { describe, expect } from "vitest";

import { handler } from "./get.private";

describe("GET /v0/identity/:service [private]", () => {
  const service = "test-service";
  const endpoint = `/identity/${service}`;

  const userId = createUserId("test-user-id");

  const identity = {
    serviceId: "existing-id",
    serviceName: "test-service",
  };

  it("returns 400 when the User-Id header is missing", async ({ sdk }) => {
    const result = await handler(
      sdk.event.get(endpoint, { params: { service } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toStrictEqual({
      headers: ["User-Id"],
      message: "Missing headers: User-Id",
    });
  });

  it("returns 200 with the identity link details", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get(`/identity/${service}`, { headers: { "User-Id": userId } })
      .reply(200, identity);

    const result = await handler(
      sdk.event.get(endpoint, {
        headers: { "User-Id": userId },
        params: { service },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(identity);
  });

  it("returns 404 when the identity does not exist", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get(`/identity/${service}`, { headers: { "User-Id": userId } })
      .reply(404);

    const result = await handler(
      sdk.event.get(endpoint, {
        headers: { "User-Id": userId },
        params: { service },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(404);
  });

  it("returns 502 when the upstream fails", async ({ http, sdk }) => {
    http
      .gateway("udp")
      .get(`/identity/${service}`, { headers: { "User-Id": userId } })
      .reply(500);

    const result = await handler(
      sdk.event.get(endpoint, {
        headers: { "User-Id": userId },
        params: { service },
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
  });
});
