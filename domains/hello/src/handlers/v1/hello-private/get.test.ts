import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./get";

describe("Hello World handler (private)", () => {
  it("GET /hello-private returns Hello private world!", async ({ event }) => {
    const response = await handler(event.get("/hello-private"), context);

    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "Hello private world!" }),
    });
  });
});
