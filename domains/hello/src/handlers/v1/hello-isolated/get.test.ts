import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("Hello World handler (isolated)", () => {
  it("GET /hello-isolated returns Hello isolated world!", async ({ event }) => {
    const response = await handler(event.get("/hello-isolated"), context);

    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "Hello isolated world!" }),
    });
  });
});
