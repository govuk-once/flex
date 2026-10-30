import { it } from "@flex/testing";
import type { GetHelloResponse } from "@schemas/index";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("GET /v1/hello", () => {
  const endpoint = "/hello";

  it("returns 200", async ({ sdk }) => {
    const expected: GetHelloResponse = { reponse: "Hello Lorenzo" };

    const result = await handler(sdk.event.get(endpoint), sdk.context());

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toStrictEqual(expected);
  });
});
