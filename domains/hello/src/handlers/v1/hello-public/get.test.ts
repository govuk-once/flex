import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("Hello World handler (public)", () => {
  it("GET /hello-public returns Hello public world!", async ({ event }) => {
    const response = await handler(event.get("/hello-public"), context);

    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "Hello public world!" }),
    });
  });
});
