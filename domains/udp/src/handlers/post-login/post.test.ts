import { it } from "@flex/testing";
import { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect } from "vitest";

import { ContextWithPairwiseId } from "../../../../../libs/middlewares/src/extract-user";
import { handler } from "./post";

describe("User Creation handler", () => {
  it("POST /create-user returns User created successfully!", async ({
    event,
    context,
  }) => {
    const response = await handler(
      event.create({
        requestContext: {
          authorizer: { lambda: { pairwiseId: "test-pairwise-id" } },
        } as unknown as APIGatewayProxyEventV2["requestContext"],
      }),
      context as unknown as ContextWithPairwiseId,
    );

    expect(response).toEqual({
      statusCode: 201,
      body: JSON.stringify({
        message: "User created successfully!",
        userId: "test-pairwise-id",
      }),
    });
  });
});
