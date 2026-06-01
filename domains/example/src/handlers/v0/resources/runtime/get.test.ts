import { it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v0/resources/runtime", () => {
  const endpoint = "/resources/runtime";

  const params = { privateGatewaysRoot: "test-param-value" };

  it("returns 200 with resolved resources", async ({ sdk }) => {
    const result = await handler(
      sdk.event.get(endpoint),
      sdk.context({ params }),
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual({
      ssm: { param: expect.any(Number) as number },
    });
  });
});
