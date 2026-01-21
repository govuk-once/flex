import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("User Creation handler", () => {
  it("POST /create-user returns User created successfully!", async ({
    response,
    eventWithAuthorizer,
  }) => {
    const request = await handler(eventWithAuthorizer.authenticated(), context);

    expect(request).toEqual(
      response.created({
        message: "User created successfully!",
        userId: "test-pairwise-id",
      }),
    );
  });
});
