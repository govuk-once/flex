import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("User Creation handler", () => {
  it("POST /create-user returns User created successfully!", async ({
    event,
  }) => {
    const response = await handler(
      event.post("/create-user", {
        body: {},
      }),
      context,
    );

    expect(response).toEqual({
      statusCode: 201,
      body: JSON.stringify({ message: "User created successfully!" }),
    });
  });
});
