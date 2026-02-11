import { it } from "@flex/testing";
import { describe, expect, vi } from "vitest";

import { handler } from "./post";

vi.mock("@flex/params", () => {
  return {
    getConfig: vi.fn(() => ({
      AWS_REGION: "eu-west-2",
      FLEX_PRIVATE_GATEWAY_URL:
        "https://execute-api.eu-west-2.amazonaws.com/gateways/udp",
    })),
  };
});
vi.mock("aws-sigv4-fetch", () => {
  return {
    createSignedFetcher: vi.fn(() => {
      return vi.fn().mockResolvedValue({
        status: 201,
        statusText: "Created",
        ok: true,
      });
    }),
  };
});

describe("post handler", () => {
  it("returns user preferences updated successfully", async ({
    response,
    internalEvent,
    context,
  }) => {
    const request = await handler(
      internalEvent.post("/user", {
        body: {
          notificationId: "test-notification-id",
        },
      }),
      context.withPairwiseId().create(),
    );

    expect(request).toEqual(
      response.created(
        {},
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
  });
});
