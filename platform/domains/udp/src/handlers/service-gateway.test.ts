import { context, it } from "@flex/testing";
import { describe, expect } from "vitest";

import { handler } from "./service-gateway";

describe("UDP Service Gateway handler", () => {
  it("returns hello", async ({ privateGatewayEvent }) => {
    const response = await handler(
      privateGatewayEvent.get("/hello-public"),
      context,
    );

    expect(response).toEqual({
      statusCode: 200,
      body: JSON.stringify({ message: "hello" }),
    });
  });
});
