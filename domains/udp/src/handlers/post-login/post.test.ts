import { apiGatewayRequestWithAuthorizer, context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./post";

describe("User Creation handler", () => {
  const responses = {
    CREATED: {
      statusCode: 201,
      body: JSON.stringify({
        message: "User created successfully!",
        userId: "test-pairwise-id",
      }),
    },
  };
  it("POST /create-user returns User created successfully!", async () => {
    const request = await handler(apiGatewayRequestWithAuthorizer, context);

    expect(request).toEqual(responses.CREATED);
  });
});
