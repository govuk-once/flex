import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v0/resources", () => {
  const endpoint = "/resources";

  const secrets = { udpNotificationSecret: "secret-value" }; // pragma: allowlist secret

  it("returns 200 with resolved resources", async ({ sdk }) => {
    const result = await handler(
      sdk.event.get(endpoint),
      sdk.context({ secrets }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      ssm: { param: expect.any(Number) as number },
      secret: { secret: expect.any(Number) as number },
      kms: { key: expect.any(Number) as number },
    });
  });
});
