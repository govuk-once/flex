import { it } from "@flex/testing";
import { localAuthority, localCouncilId, userId } from "@tests/fixtures";
import { describe, expect } from "vitest";

import { handler } from "./post.private";

describe("POST /v1/local-council/:id [private]", () => {
  const endpoint = `/local-council/${localCouncilId}`;

  it("returns 200 when the local authority is created", async ({
    http,
    sdk,
  }) => {
    http.gateway("udp").post(endpoint, { body: localAuthority }).reply(200);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        params: { id: localCouncilId },
        body: localAuthority,
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe("");
  });

  it("returns 400 when the request body is invalid", async ({ sdk }) => {
    const result = await handler(
      sdk.event.post(endpoint, { userId, params: { id: localCouncilId } }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toStrictEqual({
      message: "Invalid request body",
    });
  });

  it("returns 502 when the UDP create local authority integration fails", async ({
    http,
    sdk,
  }) => {
    http.gateway("udp").post(endpoint, { body: localAuthority }).reply(500);

    const result = await handler(
      sdk.event.post(endpoint, {
        userId,
        params: { id: localCouncilId },
        body: localAuthority,
      }),
      sdk.context(),
    );

    expect(result.statusCode).toBe(502);
    expect(result.body).toBe("");
  });
});
