import { it } from "@flex/testing";
import { createServiceName, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/identity", () => {
  const endpoint = "/identity";

  it("returns 200 with all tracking services when the user identity exists", async ({
    http,
    sdk,
  }) => {
    const services = [createServiceName("dvla"), createServiceName("hmrc")];

    http
      .gateway("udp")
      .get(`/identities/${userId}`)
      .reply(200, { data: { services } });

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({ services });
  });

  it("returns 200 with an empty services list when the user identity does not exist", async ({
    http,
    sdk,
  }) => {
    http.gateway("udp").get(`/identities/${userId}`).reply(404);

    const result = await handler(
      sdk.event.get(endpoint, { userId }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);

    expect(JSON.parse(result.body)).toStrictEqual({ services: [] });
  });

  it.for([{ reason: "fails unexpectedly", upstream: 500, expected: 502 }])(
    "returns $expected when the UDP get service identities integration $reason",
    async ({ upstream, expected }, { http, sdk }) => {
      http.gateway("udp").get(`/identities/${userId}`).reply(upstream);

      const result = await handler(
        sdk.event.get(endpoint, { userId }),
        sdk.context(),
      );

      expect(result.statusCode).toBe(expected);
      expect(result.body).toBe("");
    },
  );
});
